import React, { useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView } from "react-native";
import { StatusBar } from "expo-status-bar";
import FeedScreen from "./src/screens/FeedScreen";
import CreateScreen from "./src/screens/CreateScreen";
import ProfileScreen from "./src/screens/ProfileScreen";

type Tab = "feed" | "create" | "profile";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("feed");

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Main Screen Content */}
      <View style={styles.content}>
        {activeTab === "feed" && <FeedScreen />}
        {activeTab === "create" && <CreateScreen />}
        {activeTab === "profile" && <ProfileScreen />}
      </View>

      {/* Bottom Navigation Bar */}
      <SafeAreaView style={styles.bottomNavContainer}>
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setActiveTab("feed")}
          >
            <Text style={[styles.navIcon, activeTab === "feed" && styles.navIconActive]}>
              🔥
            </Text>
            <Text style={[styles.navLabel, activeTab === "feed" && styles.navLabelActive]}>
              For You
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.createNavItem, activeTab === "create" && styles.createNavItemActive]}
            onPress={() => setActiveTab("create")}
          >
            <Text style={styles.createNavIcon}>✨</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setActiveTab("profile")}
          >
            <Text style={[styles.navIcon, activeTab === "profile" && styles.navIconActive]}>
              👤
            </Text>
            <Text style={[styles.navLabel, activeTab === "profile" && styles.navLabelActive]}>
              Profile
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0a1a",
  },
  content: {
    flex: 1,
  },
  bottomNavContainer: {
    backgroundColor: "rgba(13, 10, 26, 0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    height: 56,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    width: 80,
  },
  navIcon: {
    fontSize: 20,
    opacity: 0.6,
  },
  navIconActive: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
  navLabel: {
    fontSize: 11,
    color: "#9f93ba",
    fontWeight: "600",
    marginTop: 2,
  },
  navLabelActive: {
    color: "#fff",
  },
  createNavItem: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2a1c4a",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#b43aff",
  },
  createNavItemActive: {
    backgroundColor: "#b43aff",
  },
  createNavIcon: {
    fontSize: 22,
  },
});
