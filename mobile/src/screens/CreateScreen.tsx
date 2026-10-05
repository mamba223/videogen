import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

export default function CreateScreen() {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState<3 | 5 | 8>(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  async function handleGenerate() {
    if (!prompt.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsGenerating(true);
    setStatusMsg("Submitting to GPU cluster queue…");

    setTimeout(() => {
      setStatusMsg("Queued! Your video is generating in the background.");
      setIsGenerating(false);
    }, 2000);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>✨ Create Video</Text>
        <Text style={styles.subtitle}>
          Turn any sentence or story script into an AI clip in seconds.
        </Text>

        <Text style={styles.label}>Prompt / Visual Description</Text>
        <TextInput
          style={styles.textArea}
          multiline
          numberOfLines={4}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="A red-haired traveler steps onto a glowing crystal bridge at dusk..."
          placeholderTextColor="#7b7194"
        />

        <Text style={styles.label}>Duration</Text>
        <View style={styles.chipRow}>
          {([3, 5, 8] as const).map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.chip, duration === d && styles.chipActive]}
              onPress={() => setDuration(d)}
            >
              <Text style={[styles.chipText, duration === d && styles.chipTextActive]}>
                {d} seconds
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.generateButtonContainer}
          disabled={isGenerating || !prompt.trim()}
          onPress={handleGenerate}
        >
          <LinearGradient
            colors={["#b43aff", "#ff3a7a"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.generateButton}
          >
            <Text style={styles.generateButtonText}>
              {isGenerating ? "Queuing…" : `✨ Generate (${duration}s · 1 Credit)`}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {statusMsg ? <Text style={styles.statusText}>{statusMsg}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0d0a1a",
  },
  container: {
    padding: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#9f93ba",
    marginBottom: 24,
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#cfc7e3",
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: "#181329",
    borderWidth: 1,
    borderColor: "#2d2447",
    borderRadius: 16,
    padding: 16,
    color: "#fff",
    fontSize: 15,
    minHeight: 110,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  chipRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 28,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#181329",
    borderWidth: 1,
    borderColor: "#2d2447",
  },
  chipActive: {
    backgroundColor: "#b43aff",
    borderColor: "transparent",
  },
  chipText: {
    color: "#9f93ba",
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#fff",
  },
  generateButtonContainer: {
    borderRadius: 16,
    overflow: "hidden",
  },
  generateButton: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  generateButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  statusText: {
    marginTop: 18,
    color: "#38e0b0",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "600",
  },
});
