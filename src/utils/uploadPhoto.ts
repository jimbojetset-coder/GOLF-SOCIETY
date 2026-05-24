/**
 * Pick, compress, and upload a player photo to Supabase Storage.
 * Returns the public URL, or null if cancelled / failed.
 */
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import { supabase } from '../api/supabase';

const BUCKET = 'player-photos';
const MAX_DIMENSION = 400; // px — avatar size, no need for more
const QUALITY = 0.75;

export async function pickAndUploadPlayerPhoto(playerId: string): Promise<string | null> {
  // 1. Request permissions
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Allow photo access to add a player photo.');
    return null;
  }

  // 2. Pick image
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];

  // 3. Compress + resize
  const compressed = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: MAX_DIMENSION, height: MAX_DIMENSION } }],
    { compress: QUALITY, format: ImageManipulator.SaveFormat.JPEG }
  );

  // 4. Read as base64
  const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // 5. Upload to Supabase Storage
  const fileName = `${playerId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, decode(base64), {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) {
    Alert.alert('Upload failed', error.message);
    return null;
  }

  // 6. Return public URL
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

/** Decode base64 string to Uint8Array for Supabase upload */
function decode(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  const len = base64.length;
  let bufferLength = Math.floor(len * 0.75);
  if (base64[len - 1] === '=') bufferLength--;
  if (base64[len - 2] === '=') bufferLength--;

  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const e1 = lookup[base64.charCodeAt(i)];
    const e2 = lookup[base64.charCodeAt(i + 1)];
    const e3 = lookup[base64.charCodeAt(i + 2)];
    const e4 = lookup[base64.charCodeAt(i + 3)];
    bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (p < bufferLength) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (p < bufferLength) bytes[p++] = ((e3 & 3) << 6) | (e4 & 63);
  }
  return bytes;
}
