import type { Backend, NewEpisode } from "@/lib/backend";
import type { Asset, Comment, CreatorProfile, Series, SeriesDetail, Video } from "@/lib/types";

/**
 * Volatile in-memory backend for local development only. Everything resets on page refresh
 * and it is never enabled in production builds (see data.ts).
 * It also simulates the server-side worker with timers, so the queue UX can be tested without Supabase.
 */
type SceneState = "queued" | "generating" | "ready" | "failed";
interface Job { scenes: SceneState[]; clips: string[] }

interface Mem {
  videos: Video[];
  series: Series[];
  assets: Asset[];
  comments: Record<string, Comment[]>;
  follows: Set<string>; // "followerId:followingId"
  credits: number;
  jobs: Record<string, Job>;
  currentUser: { id: string; email: string; username: string } | null;
}
const g = globalThis as unknown as { __rf?: Mem };

const SAMPLES = [
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://www.w3schools.com/html/mov_bbb.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
];

// Seed initial community content in demo mode so the platform feels alive
const INITIAL_VIDEOS: Video[] = [
  {
    id: "demo-v1",
    userId: "creator-mara",
    author: "mara_writer",
    title: "The Door in the Cliffs",
    prompt: "Mara discovers a glowing door in the cliffs at dawn. Moody watercolor cinematic lighting.",
    videoUrl: SAMPLES[0],
    clips: [SAMPLES[0], SAMPLES[1]],
    narrations: [
      "I had walked these sea cliffs a thousand times, but that dawn, the stone opened.",
      "Beyond the door, there was only light and the sound of waves that didn't belong to this world."
    ],
    seriesId: "demo-s1",
    episode: 1,
    visibility: "public",
    likes: 42,
    liked: false,
    commentsCount: 3,
    createdAt: Date.now() - 3600 * 1000 * 4,
    status: "ready",
    progress: 100,
    sceneCount: 2,
    isFollowingAuthor: false,
    model: "wan-2.1",
  },
  {
    id: "demo-v2",
    userId: "creator-neo",
    author: "neo_cinema",
    title: "Neon Rain Samurai",
    prompt: "Cyberpunk samurai stands under holographic neon signs in Tokyo rain, reflection in puddle.",
    videoUrl: SAMPLES[2],
    clips: [SAMPLES[2]],
    narrations: [
      "In the electric shadows of Neo-Shinjuku, silence is the only armor that endures."
    ],
    visibility: "public",
    likes: 89,
    liked: true,
    commentsCount: 5,
    createdAt: Date.now() - 3600 * 1000 * 12,
    status: "ready",
    progress: 100,
    sceneCount: 1,
    isFollowingAuthor: true,
    model: "ltx-video",
  },
  {
    id: "demo-v3",
    userId: "creator-mara",
    author: "mara_writer",
    title: "The Spiral of Light",
    prompt: "Mara descends the luminous winding staircase inside the ancient cliff spire.",
    videoUrl: SAMPLES[1],
    clips: [SAMPLES[1], SAMPLES[2]],
    narrations: [
      "Steps carved into salt and starlight, winding down deeper into the earth.",
      "At the spiral's center, the ocean was singing in a language older than fire."
    ],
    seriesId: "demo-s1",
    episode: 2,
    visibility: "public",
    likes: 31,
    liked: false,
    commentsCount: 2,
    createdAt: Date.now() - 3600 * 1000 * 2,
    status: "ready",
    progress: 100,
    sceneCount: 2,
    isFollowingAuthor: false,
    model: "wan-2.1",
  },
];

const INITIAL_SERIES: Series[] = [
  {
    id: "demo-s1",
    userId: "creator-mara",
    title: "Tales of the Lighthouse",
    bible: "Mara, a red-haired lighthouse keeper in a yellow raincoat. Moody atmospheric mystery.",
    createdAt: Date.now() - 3600 * 1000 * 24,
    episodeCount: 2,
  },
];

const INITIAL_COMMENTS: Record<string, Comment[]> = {
  "demo-v1": [
    {
      id: "c-1",
      videoId: "demo-v1",
      userId: "creator-neo",
      username: "neo_cinema",
      body: "The lighting transition at dawn was incredible! Can't wait for episode 2.",
      createdAt: Date.now() - 3600 * 1000 * 3,
    },
    {
      id: "c-2",
      videoId: "demo-v1",
      userId: "user-elena",
      username: "elena_writes",
      body: "Your story bible character consistency is spot on. Did you use reference art?",
      createdAt: Date.now() - 3600 * 1000 * 2,
    },
  ],
  "demo-v2": [
    {
      id: "c-3",
      videoId: "demo-v2",
      userId: "creator-mara",
      username: "mara_writer",
      body: "The neon reflections look so fluid. What prompt did you use for the camera angle?",
      createdAt: Date.now() - 3600 * 1000 * 8,
    },
  ],
};

const mem = (g.__rf ??= {
  videos: [...INITIAL_VIDEOS],
  series: [...INITIAL_SERIES],
  assets: [],
  comments: { ...INITIAL_COMMENTS },
  follows: new Set<string>(["user-creator:creator-neo"]),
  credits: 500,
  jobs: {},
  currentUser: { id: "user-creator", email: "writer@reelforge.ai", username: "writer_alex" },
});

const CONCURRENCY = 6;

function refresh(id: string) {
  const v = mem.videos.find((x) => x.id === id);
  const job = mem.jobs[id];
  if (!v || !job) return;
  const count = (s: SceneState) => job.scenes.filter((x) => x === s).length;
  const ready = count("ready"), failed = count("failed"), active = count("queued") + count("generating");
  v.progress = Math.round((ready / job.scenes.length) * 100);
  if (active === 0) {
    if (failed) { v.status = "failed"; v.error = "Some scenes failed or were cancelled. Credits for them were refunded."; }
    else { v.status = "ready"; v.clips = job.clips; v.videoUrl = job.clips[0]; }
  } else v.status = ready > 0 || count("generating") > 0 ? "generating" : "queued";
}

function startSimulatedWorker(id: string) {
  const job = mem.jobs[id];
  const run = async () => {
    for (;;) {
      const idx = job.scenes.indexOf("queued");
      if (idx === -1) return;
      job.scenes[idx] = "generating";
      refresh(id);
      await new Promise((r) => setTimeout(r, 3000 + Math.random() * 4000));
      if (job.scenes[idx] === "generating") {
        job.clips[idx] = SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
        job.scenes[idx] = "ready";
        refresh(id);
      }
    }
  };
  for (let i = 0; i < CONCURRENCY; i++) void run();
}

export const demo: Backend = {
  name: "demo",
  async getUser() { return mem.currentUser; },
  async signIn(email: string) {
    const raw = email.includes("@") ? email.split("@")[0] : email;
    const clean = raw.toLowerCase().replace(/[^a-z0-9_]/g, "") || "user";
    const specialIds: Record<string, string> = {
      mara_writer: "creator-mara",
      neo_cinema: "creator-neo",
    };
    mem.currentUser = {
      id: specialIds[clean] || `user-${clean}`,
      email: email.includes("@") ? email : `${clean}@reelforge.ai`,
      username: clean,
    };
    return undefined;
  },
  async signUp(email: string) {
    return this.signIn(email);
  },
  async signOut() {
    mem.currentUser = null;
  },
  async getCredits() { return mem.currentUser ? mem.credits : 0; },
  async listFeed() {
    const uid = mem.currentUser?.id;
    return mem.videos
      .filter((v) => v.visibility === "public" && v.status === "ready")
      .map((v) => ({
        ...v,
        isFollowingAuthor: uid ? mem.follows.has(`${uid}:${v.userId}`) : false,
        commentsCount: (mem.comments[v.id] ?? []).length,
      }));
  },
  async listMine() {
    const uid = mem.currentUser?.id;
    if (!uid) return [];
    return mem.videos
      .filter((v) => v.userId === uid || v.author === mem.currentUser?.username)
      .map((v) => ({ ...v, commentsCount: (mem.comments[v.id] ?? []).length }));
  },
  async getEpisode(id) {
    const v = mem.videos.find((x) => x.id === id);
    if (!v) return null;
    const uid = mem.currentUser?.id;
    return {
      ...v,
      isFollowingAuthor: uid ? mem.follows.has(`${uid}:${v.userId}`) : false,
      commentsCount: (mem.comments[v.id] ?? []).length,
    };
  },
  async enqueueEpisode(ep: NewEpisode) {
    if (!mem.currentUser) throw new Error("Please log in first.");
    const cost = ep.scenes.length;
    if (mem.credits < cost) throw new Error("insufficient_credits");
    mem.credits -= cost;
    const id = crypto.randomUUID();
    mem.videos.unshift({
      id,
      userId: mem.currentUser.id,
      author: mem.currentUser.username,
      title: ep.title,
      prompt: ep.prompt,
      videoUrl: "",
      clips: [],
      narrations: ep.scenes.map((s) => s.narration).filter(Boolean),
      seriesId: ep.seriesId,
      episode: ep.episode,
      visibility: ep.visibility,
      likes: 0,
      liked: false,
      commentsCount: 0,
      createdAt: Date.now(),
      status: "queued",
      progress: 0,
      sceneCount: cost,
      audioTrackUrl: ep.audioTrackUrl,
      audioTrackTitle: ep.audioTrackTitle,
      model: ep.model || "wan-2.1",
      voiceId: ep.voiceId,
    });
    mem.jobs[id] = { scenes: new Array(cost).fill("queued"), clips: new Array(cost).fill("") };
    startSimulatedWorker(id);
    return id;
  },
  async cancelEpisode(id) {
    const job = mem.jobs[id];
    if (!job) return 0;
    let n = 0;
    job.scenes = job.scenes.map((s) => { if (s === "queued") { n++; return "failed"; } return s; });
    mem.credits += n;
    refresh(id);
    return n;
  },
  async setVisibility(id, visibility) {
    const v = mem.videos.find((x) => x.id === id);
    if (v) v.visibility = visibility;
  },
  async toggleLike(video) {
    const v = mem.videos.find((x) => x.id === video.id);
    if (v) { v.liked = !v.liked; v.likes += v.liked ? 1 : -1; }
  },
  async listSeries() { return [...mem.series]; },
  async createSeries(title, bible) {
    if (!mem.currentUser) throw new Error("Please log in first.");
    const id = crypto.randomUUID();
    mem.series.unshift({ id, userId: mem.currentUser.id, title, bible, createdAt: Date.now() });
    return id;
  },
  async nextEpisode(seriesId) { return mem.videos.filter((v) => v.seriesId === seriesId).length + 1; },
  async listAssets(seriesId) { return mem.assets.filter((a) => !seriesId || a.seriesId === seriesId); },
  async addAsset(file, kind, seriesId, text) {
    const a: Asset = { id: crypto.randomUUID(), seriesId, kind, name: file.name, url: URL.createObjectURL(file), text, createdAt: Date.now() };
    mem.assets.unshift(a);
    return a;
  },
  async deleteAsset(id) { mem.assets = mem.assets.filter((a) => a.id !== id); },

  // ---- Comments ----
  async listComments(videoId) {
    return [...(mem.comments[videoId] ?? [])];
  },
  async addComment(videoId, body) {
    if (!mem.currentUser) throw new Error("Please log in to comment");
    const newComment: Comment = {
      id: crypto.randomUUID(),
      videoId,
      userId: mem.currentUser.id,
      username: mem.currentUser.username,
      body: body.trim(),
      createdAt: Date.now(),
    };
    if (!mem.comments[videoId]) mem.comments[videoId] = [];
    mem.comments[videoId].push(newComment);
    const v = mem.videos.find((x) => x.id === videoId);
    if (v) v.commentsCount = mem.comments[videoId].length;
    return newComment;
  },
  async deleteComment(commentId) {
    for (const vid of Object.keys(mem.comments)) {
      mem.comments[vid] = mem.comments[vid].filter((c) => c.id !== commentId);
      const v = mem.videos.find((x) => x.id === vid);
      if (v) v.commentsCount = mem.comments[vid].length;
    }
  },

  // ---- Following ----
  async toggleFollow(targetUserId) {
    if (!mem.currentUser) throw new Error("Please log in to follow creators");
    if (mem.currentUser.id === targetUserId) throw new Error("You cannot follow yourself");
    const key = `${mem.currentUser.id}:${targetUserId}`;
    if (mem.follows.has(key)) {
      mem.follows.delete(key);
      return false;
    } else {
      mem.follows.add(key);
      return true;
    }
  },

  // ---- Public Creator Profile ----
  async getCreatorProfile(username) {
    const creatorProfiles: Record<string, Partial<CreatorProfile>> = {
      mara_writer: {
        id: "creator-mara",
        username: "mara_writer",
        displayName: "Mara Vance",
        bio: "Fantasy & speculative fiction writer. Turning my worldbuilding and chapters into visual reels.",
        followersCount: 1240,
        followingCount: 38,
      },
      neo_cinema: {
        id: "creator-neo",
        username: "neo_cinema",
        displayName: "Neo Cinema Studio",
        bio: "Cyberpunk and sci-fi aesthetic videos. Exploring short episodic AI cinema.",
        followersCount: 3820,
        followingCount: 112,
      },
      demo: {
        id: "demo",
        username: "demo",
        displayName: "You (Demo)",
        bio: "Creator on ReelForge",
        followersCount: 15,
        followingCount: 2,
      },
    };

    const base = creatorProfiles[username] ?? {
      id: `user-${username}`,
      username,
      displayName: username,
      bio: "Creator on ReelForge",
      followersCount: 0,
      followingCount: 0,
    };

    const myId = mem.currentUser?.id;
    const isFollowing = myId ? mem.follows.has(`${myId}:${base.id}`) : false;
    const authorVideos = mem.videos.filter((v) => v.author === username && v.visibility === "public" && v.status === "ready");
    const authorSeries = mem.series.filter((s) => s.userId === base.id);

    return {
      id: base.id!,
      username: base.username!,
      displayName: base.displayName,
      bio: base.bio,
      avatarUrl: base.avatarUrl,
      followersCount: base.followersCount! + (isFollowing && !creatorProfiles[username] ? 1 : 0),
      followingCount: base.followingCount!,
      isFollowing,
      videos: authorVideos,
      series: authorSeries,
    };
  },

  // ---- Series Binge Hub ----
  async getSeriesDetail(seriesId) {
    const s = mem.series.find((x) => x.id === seriesId);
    if (!s) return null;
    const episodes = mem.videos
      .filter((v) => v.seriesId === seriesId && v.visibility === "public" && v.status === "ready")
      .sort((a, b) => (a.episode ?? 1) - (b.episode ?? 1));
    const creator = episodes[0]?.author ?? (s.userId === "creator-mara" ? "mara_writer" : "creator");
    return {
      ...s,
      creatorUsername: creator,
      creatorId: s.userId,
      episodes,
      episodeCount: episodes.length,
    };
  },

  // ---- Reporting & Moderation ----
  async reportVideo(videoId, reason) {
    console.log(`[Report Received] video=${videoId} reason=${reason} user=${mem.currentUser?.username}`);
  },
};
