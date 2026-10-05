import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function ProfileScreen() {
  const [username] = useState("writer_alex");
  const [credits] = useState(500);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.avatarContainer}>
          <LinearGradient colors={["#b43aff", "#ff3a7a"]} style={styles.avatar}>
            <Text style={styles.avatarText}>{username[0].toUpperCase()}</Text>
          </LinearGradient>
          <Text style={styles.username}>@{username}</Text>
          <Text style={styles.bio}>Storyteller & Episodic AI Filmmaker</Text>
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>12</Text>
            <Text style={styles.statLabel}>Videos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>3</Text>
            <Text style={styles.statLabel}>Series</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: "#38e0b0" }]}>{credits}</Text>
            <Text style={styles.statLabel}>Credits</Text>
          </View>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.chipButton}>
            <Text style={styles.chipButtonText}>⚡ Top-Up Credits</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chipButton}>
            <Text style={styles.chipButtonText}>📚 Library</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Studio Videos</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Tap ✨ Create to generate your next clip.</Text>
        </View>
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
    alignItems: "center",
  },
  avatarContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
  },
  username: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  bio: {
    fontSize: 14,
    color: "#9f93ba",
  },
  statsCard: {
    flexDirection: "row",
    backgroundColor: "#181329",
    borderWidth: 1,
    borderColor: "#2d2447",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: "100%",
    justifyContent: "space-around",
    alignItems: "center",
    marginBottom: 24,
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },
  statLabel: {
    fontSize: 12,
    color: "#9f93ba",
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#2d2447",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 32,
  },
  chipButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: "#201838",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#3a2d59",
  },
  chipButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  sectionTitle: {
    alignSelf: "flex-start",
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 14,
  },
  emptyCard: {
    width: "100%",
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2d2447",
    borderStyle: "dashed",
    alignItems: "center",
  },
  emptyText: {
    color: "#7b7194",
    fontSize: 14,
  },
});
