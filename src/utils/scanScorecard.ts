/**
 * Scorecard scan utility
 *
 * 1. Pick or shoot photo
 * 2. Compress client-side (max 1200px, 0.8 quality → typically < 300KB)
 * 3. Upload to Supabase Storage (scorecards bucket)
 * 4. Create ScorecardScan record
 * 5. Call scorecardOcr edge function
 * 6. Return extracted data
 */
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import { supabase } from '../api/supabase';

const BUCKET = 'scorecards';
const MAX_DIMENSION = 1200;
const QUALITY = 0.82;

export interface ScanResult {
  scan_id: string;
  image_url: string;
  extracted: ExtractedScorecard;
}

export interface ExtractedScorecard {
  course_name: string;
  tees: ExtractedTee[];
  holes: ExtractedHole[];
}

export interface ExtractedTee {
  tee_name: string;
  tee_colour: string;
  course_rating: number | null;
  slope_rating: number | null;
  total_yards: number | null;
  total_par: number;
}

export interface ExtractedHole {
  hole_number: number;
  par: number;
  stroke_index: number;
  yards_by_tee: Record<string, number>;
}

export type ScanSource = 'camera' | 'library';

/** Pick or shoot a scorecard image, compress, upload, and OCR. */
export async function scanScorecard(
  source: ScanSource,
  userId: string,
  onProgress?: (step: string) => void,
): Promise<ScanResult | null> {

  // 1. Request permissions
  if (source === 'camera') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera permission needed', 'Allow camera access to scan a scorecard.');
      return null;
    }
  } else {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photo library permission needed', 'Allow photo access to select a scorecard.');
      return null;
    }
  }

  // 2. Pick / shoot
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 1 })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 });

  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];

  // 3. Compress
  onProgress?.('Compressing image…');
  const compressed = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: MAX_DIMENSION } }],
    { compress: QUALITY, format: ImageManipulator.SaveFormat.JPEG }
  );

  // 4. Read as base64
  const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // 5. Upload to storage
  onProgress?.('Uploading…');
  const fileName = `${userId}/${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, decodeBase64(base64), { contentType: 'image/jpeg', upsert: false });

  if (uploadError) {
    Alert.alert('Upload failed', uploadError.message);
    return null;
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  const image_url = urlData.publicUrl;

  // 6. Create scan record
  const { data: scanRecord, error: scanError } = await supabase
    .from('scorecard_scans')
    .insert({ image_url, status: 'pending', uploaded_by_user_id: userId })
    .select()
    .single();

  if (scanError || !scanRecord) {
    Alert.alert('Error', 'Could not create scan record.');
    return null;
  }

  // 7. Call OCR edge function
  onProgress?.('Reading scorecard with AI…');
  const { data: fnData, error: fnError } = await supabase.functions.invoke('scorecardOcr', {
    body: { image_url, scan_id: scanRecord.id },
  });

  if (fnError || !fnData?.success) {
    const msg = fnData?.error ?? fnError?.message ?? 'OCR failed';
    await supabase.from('scorecard_scans').update({ status: 'error', error_message: msg }).eq('id', scanRecord.id);
    Alert.alert('Scan failed', msg + '\n\nTry a clearer, well-lit photo with the full scorecard visible.');
    return null;
  }

  return {
    scan_id: scanRecord.id,
    image_url,
    extracted: fnData.extracted as ExtractedScorecard,
  };
}

/** Decode base64 to Uint8Array */
function decodeBase64(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  const len = base64.length;
  let bufLen = Math.floor(len * 0.75);
  if (base64[len - 1] === '=') bufLen--;
  if (base64[len - 2] === '=') bufLen--;
  const bytes = new Uint8Array(bufLen);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const e1 = lookup[base64.charCodeAt(i)];
    const e2 = lookup[base64.charCodeAt(i + 1)];
    const e3 = lookup[base64.charCodeAt(i + 2)];
    const e4 = lookup[base64.charCodeAt(i + 3)];
    bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (p < bufLen) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (p < bufLen) bytes[p++] = ((e3 & 3) << 6) | (e4 & 63);
  }
  return bytes;
}
