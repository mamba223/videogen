import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  ViewToken,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { fetchFeed, type MobileVideo } from "../lib/api";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function FeedScreen() {
  const [videos, setVideos] = useState<MobileVideo[]>([]);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);

  useEffect(() => {
    fetchFeed().then(setVideos);
  }, []);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveVideoIndex(viewableItems[0].index);
    }
  }).current;

  function handleLike(item: MobileVideo) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setVideos((prev) =>
      prev.map((v) =>
        v.id === item.id
          ? { ...v, liked: !v.liked, likes: v.likes + (v.liked ? -1 : 1) }
          : v
      )
    );
  }

  const renderItem = ({ item, index }: { item: MobileVideo; index: number }) => {
    const isFocused = index === activeVideoIndex;
    return (
      <View style={styles.reelContainer}>
        <Video
          source={{ uri: item.videoUrl }}
          style={StyleSheet.absoluteFillObject}
          resizeMode={ResizeMode.COVER}
          shouldPlay={isFocused}
          isLooping
          isMuted={false}
        />

        {/* Gradient Overlay for Subtitles / Prompt */}
        <LinearGradient
          colors={["transparent", "rgba(13, 10, 26, 0.95)"]}
          style={styles.bottomOverlay}
        >
          <Text style={styles.authorText}>@{item.author}</Text>
          {item.seriesId && (
            <View style={styles.seriesTag}>
              <Text style={styles.seriesTagText}>📖 Series · Ep. {item.episode ?? 1}</Text>
            </View>
          )}
          <Text style={styles.promptText} numberOfLines={3}>
            {item.prompt}
          </Text>
        </LinearGradient>

        {/* Action Buttons Column */}
        <View style={styles.actionsColumn}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(item)}>
            <View style={[styles.iconCircle, item.liked && styles.iconCircleActive]}>
              <Text style={styles.actionIcon}>{item.liked ? "♥" : "♡"}</Text>
            </View>
            <Text style={styles.actionCount}>{item.likes}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn}>
            <View style={styles.iconCircle}>
              <Text style={styles.actionIcon}>💬</Text>
            </View>
            <Text style={styles.actionCount}>{item.commentsCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn}>
            <View style={styles.iconCircle}>
              <Text style={styles.actionIcon}>🔗</Text>
            </View>
            <Text style={styles.actionCount}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={videos}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0a1a",
  },
  reelContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    position: "relative",
  },
  bottomOverlay: {
    position: "absolute",
    bottom: 80,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 24,
  },
  authorText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  seriesTag: {
    alignSelf: "flex-start",
    backgroundColor: "#b43aff",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 8,
  },
  seriesTagText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  promptText: {
    color: "rgba(255, 255, 255, 0.88)",
    fontSize: 14,
    lineHeight: 20,
  },
  actionsColumn: {
    position: "absolute",
    right: 14,
    bottom: 120,
    alignItems: "center",
    gap: 16,
  },
  actionBtn: {
    alignItems: "center",
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(30, 20, 50, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  iconCircleActive: {
    backgroundColor: "#ff3a7a",
  },
  actionIcon: {
    fontSize: 22,
    color: "#fff",
  },
  actionCount: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
});
