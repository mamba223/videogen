import { createClient } from "@/lib/supabase";
import type { Backend, NewEpisode } from "@/lib/backend";
import type { Asset, AssetKind, Comment, CreatorProfile, Series, SeriesDetail, Video } from "@/lib/types";

const sb = () => createClient();
const BUCKET = "story-assets";

interface Row {
  id: string; user_id: string; title: string | null; prompt: string; video_url: string | null; clips: string[] | null;
  series_id: string | null; episode_number: number | null; visibility: "public" | "private";
  like_count: number; comment_count?: number; created_at: string; status: string; scene_count: number;
  progress: number; error: string | null; model?: string | null;
  profiles?: { username: string } | null;
}
const COLS = "id,user_id,title,prompt,video_url,clips,series_id,episode_number,visibility,like_count,comment_count,created_at,status,scene_count,progress,error,model,profiles!videos_user_id_fkey(username)";

const toVideo = (r: Row, liked: Set<string>, following: Set<string>): Video => ({
  id: r.id, userId: r.user_id, title: r.title ?? undefined, prompt: r.prompt, videoUrl: r.video_url ?? r.clips?.[0] ?? "",
  clips: r.clips ?? [], seriesId: r.series_id ?? undefined, episode: r.episode_number ?? undefined,
  visibility: r.visibility, likes: r.like_count, liked: liked.has(r.id), commentsCount: r.comment_count ?? 0,
  createdAt: Date.parse(r.created_at), author: r.profiles?.username, isFollowingAuthor: following.has(r.user_id),
  status: r.status === "ready" ? "ready" : r.status === "failed" || r.status === "rejected" ? "failed" : r.status === "queued" ? "queued" : "generating",
  progress: r.progress, error: r.error ?? undefined,
  sceneCount: r.scene_count,
  model: r.model ?? "wan-2.1",
});

async function uid() { return (await sb().auth.getUser()).data.user?.id; }

async function likedSet(ids: string[]) {
  const id = await uid();
  if (!id || !ids.length) return new Set<string>();
  const { data } = await sb().from("likes").select("video_id").eq("user_id", id).in("video_id", ids);
  return new Set((data ?? []).map((l) => l.video_id as string));
}

async function followingSet(authorIds: string[]) {
  const id = await uid();
  if (!id || !authorIds.length) return new Set<string>();
  const { data } = await sb().from("follows").select("following_id").eq("follower_id", id).in("following_id", authorIds);
  return new Set((data ?? []).map((f) => f.following_id as string));
}

export const cloud: Backend = {
  name: "cloud",
  async getUser() {
    const { data } = await sb().auth.getUser();
    if (!data.user) return null;
    const { data: p } = await sb().from("profiles").select("username").eq("id", data.user.id).single();
    return { id: data.user.id, email: data.user.email ?? "", username: p?.username ?? "user" };
  },
  async signIn(email, password) { return (await sb().auth.signInWithPassword({ email, password })).error?.message; },
  async signUp(email, password) { return (await sb().auth.signUp({ email, password })).error?.message; },
  async signOut() { await sb().auth.signOut(); },

  async getCredits() {
    const id = await uid();
    if (!id) return 0;
    const { data } = await sb().from("profiles").select("credits").eq("id", id).single();
    return data?.credits ?? 0;
  },

  async listFeed() {
    const { data } = await sb().from("videos").select(COLS).eq("visibility", "public").eq("status", "ready")
      .order("created_at", { ascending: false }).limit(50);
    const rows = (data ?? []) as unknown as Row[];
    const liked = await likedSet(rows.map((r) => r.id));
    const following = await followingSet(rows.map((r) => r.user_id));
    return rows.map((r) => toVideo(r, liked, following));
  },
  async listMine() {
    const id = await uid();
    if (!id) return [];
    const { data } = await sb().from("videos").select(COLS).eq("user_id", id).order("created_at", { ascending: false });
    const rows = (data ?? []) as unknown as Row[];
    const liked = await likedSet(rows.map((r) => r.id));
    return rows.map((r) => toVideo(r, liked, new Set()));
  },

  async getEpisode(id) {
    const { data, error } = await sb().from("videos").select(COLS).eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const row = data as unknown as Row;
    const liked = await likedSet([id]);
    const following = await followingSet([row.user_id]);
    return toVideo(row, liked, following);
  },
  async enqueueEpisode(ep: NewEpisode) {
    const { data, error } = await sb().rpc("enqueue_episode", {
      p_title: ep.title ?? "", p_prompt: ep.prompt, p_series: ep.seriesId ?? null, p_episode: ep.episode ?? null,
      p_visibility: ep.visibility, p_scenes: ep.scenes, p_style: ep.style ?? null,
      p_refs: ep.referenceAssetIds ?? [], p_scene_seconds: ep.sceneSeconds,
      p_model: ep.model || "wan-2.1",
    });
    if (error) {
      if (error.message.includes("insufficient_credits")) throw new Error("insufficient_credits");
      if (error.message.includes("not_authenticated")) throw new Error("Please log in first.");
      throw new Error(error.message);
    }
    return data as string;
  },
  async cancelEpisode(id) {
    const { data, error } = await sb().rpc("cancel_episode", { p_video: id });
    if (error) throw new Error(error.message);
    return (data as number) ?? 0;
  },
  async setVisibility(id, visibility) {
    const { error } = await sb().rpc("set_visibility", { p_video: id, p_visibility: visibility });
    if (error) throw new Error(error.message);
  },

  async toggleLike(video) {
    const id = await uid();
    if (!id) throw new Error("Sign in required");
    if (video.liked) await sb().from("likes").delete().eq("user_id", id).eq("video_id", video.id);
    else await sb().from("likes").insert({ user_id: id, video_id: video.id });
  },

  async listSeries() {
    const id = await uid();
    if (!id) return [];
    const { data } = await sb().from("series").select("id,title,bible,created_at").eq("user_id", id).order("created_at", { ascending: false });
    return (data ?? []).map((s) => ({ id: s.id, title: s.title, bible: s.bible ?? "", createdAt: Date.parse(s.created_at) }) as Series);
  },
  async createSeries(title, bible) {
    const id = await uid();
    if (!id) throw new Error("Sign in required");
    const { data, error } = await sb().from("series").insert({ user_id: id, title, bible }).select("id").single();
    if (error) throw error;
    return data.id as string;
  },
  async nextEpisode(seriesId) {
    const { count } = await sb().from("videos").select("id", { count: "exact", head: true }).eq("series_id", seriesId);
    return (count ?? 0) + 1;
  },

  async listAssets(seriesId) {
    const id = await uid();
    if (!id) return [];
    let q = sb().from("story_assets").select("*").eq("user_id", id).order("created_at", { ascending: false });
    if (seriesId) q = q.eq("series_id", seriesId);
    const { data } = await q;
    const rows = data ?? [];
    const { data: signed } = await sb().storage.from(BUCKET).createSignedUrls(rows.map((r) => r.storage_path), 3600);
    return rows.map((r, i) => ({
      id: r.id, seriesId: r.series_id ?? undefined, kind: r.kind, name: r.name,
      url: signed?.[i]?.signedUrl ?? "", text: r.extracted_text ?? undefined, createdAt: Date.parse(r.created_at),
    }) as Asset);
  },
  async addAsset(file, kind: AssetKind, seriesId, text) {
    const id = await uid();
    if (!id) throw new Error("Sign in required");
    const path = `${id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const up = await sb().storage.from(BUCKET).upload(path, file, { contentType: file.type });
    if (up.error) throw up.error;
    const { data, error } = await sb().from("story_assets").insert({
      user_id: id, series_id: seriesId ?? null, kind, name: file.name, storage_path: path,
      mime_type: file.type, size_bytes: file.size, extracted_text: text ?? null,
    }).select("*").single();
    if (error) throw error;
    const { data: signed } = await sb().storage.from(BUCKET).createSignedUrl(path, 3600);
    return { id: data.id, seriesId, kind, name: file.name, url: signed?.signedUrl ?? "", text, createdAt: Date.now() };
  },
  async deleteAsset(assetId) {
    const { data } = await sb().from("story_assets").select("storage_path").eq("id", assetId).single();
    if (data) await sb().storage.from(BUCKET).remove([data.storage_path]);
    await sb().from("story_assets").delete().eq("id", assetId);
  },

  // ---- Comments ----
  async listComments(videoId) {
    const { data, error } = await sb()
      .from("comments")
      .select("id,video_id,user_id,body,created_at,profiles(username)")
      .eq("video_id", videoId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((c: any) => ({
      id: c.id,
      videoId: c.video_id,
      userId: c.user_id,
      username: (Array.isArray(c.profiles) ? c.profiles[0]?.username : c.profiles?.username) ?? "user",
      body: c.body,
      createdAt: Date.parse(c.created_at),
    }));
  },
  async addComment(videoId, body) {
    const id = await uid();
    if (!id) throw new Error("Please log in to comment");
    const { data, error } = await sb()
      .from("comments")
      .insert({ video_id: videoId, user_id: id, body: body.trim() })
      .select("id,video_id,user_id,body,created_at,profiles(username)")
      .single();
    if (error) throw error;
    const row = data as any;
    return {
      id: row.id,
      videoId: row.video_id,
      userId: row.user_id,
      username: (Array.isArray(row.profiles) ? row.profiles[0]?.username : row.profiles?.username) ?? "user",
      body: row.body,
      createdAt: Date.parse(row.created_at),
    };
  },
  async deleteComment(commentId) {
    const id = await uid();
    if (!id) throw new Error("Please log in first");
    const { error } = await sb().from("comments").delete().eq("id", commentId).eq("user_id", id);
    if (error) throw error;
  },

  // ---- Following ----
  async toggleFollow(targetUserId) {
    const id = await uid();
    if (!id) throw new Error("Please log in to follow creators");
    if (id === targetUserId) throw new Error("You cannot follow yourself");
    const { data: existing } = await sb()
      .from("follows")
      .select("follower_id")
      .eq("follower_id", id)
      .eq("following_id", targetUserId)
      .maybeSingle();

    if (existing) {
      await sb().from("follows").delete().eq("follower_id", id).eq("following_id", targetUserId);
      return false;
    } else {
      await sb().from("follows").insert({ follower_id: id, following_id: targetUserId });
      return true;
    }
  },

  // ---- Public Creator Profile ----
  async getCreatorProfile(username) {
    const { data: profile } = await sb()
      .from("profiles")
      .select("id,username,display_name,bio,avatar_url")
      .eq("username", username)
      .maybeSingle();
    if (!profile) return null;

    const myId = await uid();
    const [followersRes, followingRes, isFollowingRes, videosRes, seriesRes] = await Promise.all([
      sb().from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", profile.id),
      sb().from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", profile.id),
      myId ? sb().from("follows").select("follower_id").eq("follower_id", myId).eq("following_id", profile.id).maybeSingle() : Promise.resolve({ data: null }),
      sb().from("videos").select(COLS).eq("user_id", profile.id).eq("visibility", "public").eq("status", "ready").order("created_at", { ascending: false }),
      sb().from("series").select("id,title,bible,created_at").eq("user_id", profile.id).eq("visibility", "public").order("created_at", { ascending: false }),
    ]);

    const videoRows = (videosRes.data ?? []) as unknown as Row[];
    const liked = await likedSet(videoRows.map((r) => r.id));
    const followingSetIds = new Set<string>(isFollowingRes.data ? [profile.id] : []);

    return {
      id: profile.id,
      username: profile.username,
      displayName: profile.display_name ?? undefined,
      bio: profile.bio ?? undefined,
      avatarUrl: profile.avatar_url ?? undefined,
      followersCount: followersRes.count ?? 0,
      followingCount: followingRes.count ?? 0,
      isFollowing: Boolean(isFollowingRes.data),
      videos: videoRows.map((r) => toVideo(r, liked, followingSetIds)),
      series: (seriesRes.data ?? []).map((s: any) => ({
        id: s.id,
        title: s.title,
        bible: s.bible ?? "",
        createdAt: Date.parse(s.created_at),
      })),
    };
  },

  // ---- Series Detail / Playlist ----
  async getSeriesDetail(seriesId) {
    const { data: s } = await sb()
      .from("series")
      .select("id,user_id,title,bible,created_at,profiles(username)")
      .eq("id", seriesId)
      .maybeSingle();
    if (!s) return null;

    const { data: vids } = await sb()
      .from("videos")
      .select(COLS)
      .eq("series_id", seriesId)
      .eq("visibility", "public")
      .eq("status", "ready")
      .order("episode_number", { ascending: true });

    const rows = (vids ?? []) as unknown as Row[];
    const liked = await likedSet(rows.map((r) => r.id));
    const following = await followingSet(rows.map((r) => r.user_id));

    return {
      id: s.id,
      userId: s.user_id,
      title: s.title,
      bible: s.bible ?? "",
      createdAt: Date.parse(s.created_at),
      creatorId: s.user_id,
      creatorUsername: (s as any).profiles?.username,
      episodes: rows.map((r) => toVideo(r, liked, following)),
      episodeCount: rows.length,
    };
  },

  // ---- Reporting & Moderation ----
  async reportVideo(videoId, reason) {
    const id = await uid();
    const { error } = await sb().from("reports").insert({
      video_id: videoId,
      reporter_id: id ?? null,
      reason,
    });
    if (error) throw error;
  },
};
