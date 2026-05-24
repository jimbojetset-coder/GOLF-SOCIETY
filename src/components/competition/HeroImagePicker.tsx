/**
 * Hero image picker for competition setup.
 * Shows stock options + an "Upload your own" option.
 */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image,
  StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../../api/supabase';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import { HERO_IMAGES } from '../../constants/heroImages';

interface Props {
  value: string | null;
  onChange: (url: string) => void;
}

export default function HeroImagePicker({ value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);

  const handleCustomUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 1,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const fileName = `hero-${Date.now()}.jpg`;
      const bytes = decode(base64);

      const { error } = await supabase.storage
        .from('competition-heroes')
        .upload(fileName, bytes, { contentType: 'image/jpeg', upsert: true });

      if (!error) {
        const { data } = supabase.storage.from('competition-heroes').getPublicUrl(fileName);
        onChange(data.publicUrl);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Hero image</Text>
      <Text style={styles.hint}>Shown behind the hole number during scoring.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {/* Upload custom */}
        <TouchableOpacity
          style={[styles.thumb, styles.uploadThumb]}
          onPress={handleCustomUpload}
          disabled={uploading}
        >
          {uploading
            ? <ActivityIndicator color={COLORS.accent} />
            : <>
                <Ionicons name="cloud-upload-outline" size={24} color={COLORS.accent} />
                <Text style={styles.uploadLabel}>Your photo</Text>
              </>
          }
        </TouchableOpacity>

        {/* Stock options */}
        {HERO_IMAGES.map(img => {
          const selected = value === img.uri;
          return (
            <TouchableOpacity
              key={img.id}
              style={[styles.thumb, selected && styles.thumbSelected]}
              onPress={() => onChange(img.uri)}
            >
              <Image source={{ uri: img.uri }} style={styles.thumbImg} />
              {selected && (
                <View style={styles.selectedOverlay}>
                  <Ionicons name="checkmark-circle" size={24} color="#fff" />
                </View>
              )}
              <View style={styles.thumbLabel}>
                <Text style={styles.thumbLabelText}>{img.label}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Preview of selected */}
      {value && (
        <Image
          source={{ uri: value }}
          style={styles.preview}
          resizeMode="cover"
        />
      )}
    </View>
  );
}

function decode(base64: string): Uint8Array {
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

const styles = StyleSheet.create({
  container: { gap: SPACING.sm },
  label: { fontSize: 13, color: COLORS.textSecondary },
  hint: { fontSize: 11, color: COLORS.textMuted },
  row: { gap: 10, paddingVertical: 4 },
  thumb: {
    width: 120, height: 75, borderRadius: RADIUS.md,
    overflow: 'hidden', borderWidth: 2, borderColor: 'transparent',
    backgroundColor: COLORS.surfaceHigh,
  },
  thumbSelected: { borderColor: COLORS.accent },
  thumbImg: { width: '100%', height: '100%' },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center', alignItems: 'center',
  },
  thumbLabel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 3,
  },
  thumbLabelText: { fontSize: 9, color: '#fff', fontWeight: '700', textAlign: 'center' },
  uploadThumb: {
    justifyContent: 'center', alignItems: 'center', gap: 4,
    borderStyle: 'dashed', borderWidth: 2, borderColor: COLORS.accent,
  },
  uploadLabel: { fontSize: 10, color: COLORS.accent, fontWeight: '700' },
  preview: {
    width: '100%', height: 120, borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
});
