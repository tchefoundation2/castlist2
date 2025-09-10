import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Guide, Book, User } from '../types';
import { getFarcasterUser } from './farcasterService';

// Supabase configuration
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rygpuqnqaagihwoapdix.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5Z3B1cW5xYWFnaWh3b2FwZGl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMDU5MDAsImV4cCI6MjA3Mjg4MTkwMH0.DxkNHZ7duGlAYR03GEPPsMaHGK9UPdgUT5fo--eZhGQ';

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export default supabase;

// =================================================================================
// USER PROFILE OPERATIONS
// =================================================================================

export const getOrCreateUserProfile = async (farcasterUser: { fid: number; username: string; pfp_url: string }): Promise<User> => {
  try {
    // 1. Try to get fresh data from Farcaster API
    let farcasterData = null;
    try {
      farcasterData = await getFarcasterUser(farcasterUser.fid);
      console.log("✅ Fetched fresh Farcaster data:", farcasterData);
    } catch (error) {
      console.warn("⚠️ Could not fetch fresh Farcaster data, using provided data:", error);
    }

    // Use fresh data if available, otherwise fall back to provided data
    const userData = farcasterData || farcasterUser;

    // 2. Check if user with this FID exists in our database
    const { data: existingProfile, error: selectError } = await supabase
      .from('profiles')
      .select('*')
      .eq('fid', userData.fid)
      .single();

    if (selectError && selectError.code !== 'PGRST116') { // PGRST116 = "The result contains 0 rows"
      console.error("❌ Error fetching profile by FID:", selectError);
      throw selectError;
    }

    if (existingProfile) {
      // Update with fresh Farcaster data if available
      if (farcasterData) {
        const { data: updatedProfile, error: updateError } = await supabase
          .from('profiles')
          .update({ 
            username: farcasterData.username,
            pfp_url: farcasterData.pfp_url,
            updated_at: new Date().toISOString()
          })
          .eq('fid', userData.fid)
          .select()
          .single();
        
        if (updateError) {
          console.error("❌ Error updating profile:", updateError);
          return existingProfile; // return old profile on failure
        }
        console.log("✅ Profile updated with fresh data");
        return updatedProfile;
      }
      return existingProfile;
    }

    // 3. Create a new profile
    const newUser: Omit<User, 'email'> = {
      id: crypto.randomUUID(),
      fid: userData.fid,
      username: userData.username,
      pfp_url: userData.pfp_url,
    };

    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert(newUser)
      .select()
      .single();

    if (insertError) {
      console.error("❌ Error creating new profile:", insertError);
      throw insertError;
    }

    console.log("✅ New profile created");
    return newProfile;
  } catch (error) {
    console.error("❌ Error in getOrCreateUserProfile:", error);
    throw error;
  }
};

// Set user context for RLS
export const setUserContext = async (fid: number) => {
  try {
    const { error } = await supabase.rpc('set_current_user_fid', { user_fid: fid });
    if (error) {
      console.error("❌ Error setting user context:", error);
    }
  } catch (error) {
    console.error("❌ Error in setUserContext:", error);
  }
};

// =================================================================================
// GUIDE OPERATIONS
// =================================================================================

export const getMyGuides = async (userId: string): Promise<Guide[]> => {
  try {
    console.log("📚 Fetching guides for user:", userId);
    
    // Get user FID from userId
    const { data: profile } = await supabase
      .from('profiles')
      .select('fid')
      .eq('id', userId)
      .single();
    
    if (!profile?.fid) {
      console.error("❌ Profile not found for userId:", userId);
      return [];
    }

    // Set user context for RLS
    await setUserContext(profile.fid);

    // Get user's guides
    const { data: guides, error } = await supabase
      .from('guides')
      .select(`
        *,
        profiles!guides_creator_fid_fkey (username, pfp_url),
        guide_books (
          books (*)
        ),
        guide_likes (count)
      `)
      .eq('creator_fid', profile.fid)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("❌ Error fetching user guides:", error);
      return [];
    }

    // Transform data to Guide interface
    const transformedGuides: Guide[] = guides.map((guide: any) => ({
      id: guide.id,
      title: guide.title,
      description: guide.description,
      tags: guide.tags || [],
      isPublic: guide.is_public,
      createdAt: guide.created_at,
      authorId: userId,
      authorFid: guide.creator_fid,
      authorUsername: guide.profiles?.username || 'Unknown',
      authorPfpUrl: guide.profiles?.pfp_url || '',
      likes: guide.guide_likes?.length || 0,
      dislikes: 0, // Not implemented yet
      books: guide.guide_books?.map((gb: any) => ({
        id: gb.books.id,
        title: gb.books.title,
        author: gb.books.author,
        notes: gb.books.notes,
        coverUrl: gb.books.cover_url,
        purchaseLink: gb.books.purchase_link,
        likes: 0, // Will be loaded separately
        dislikes: 0
      })) || []
    }));

    console.log(`✅ Fetched ${transformedGuides.length} user guides`);
    return transformedGuides;
  } catch (error) {
    console.error("❌ Error in getMyGuides:", error);
    return [];
  }
};

export const getPublicGuides = async (): Promise<Guide[]> => {
  try {
    console.log("🌍 Fetching public guides");
    
    const { data: guides, error } = await supabase
      .from('guides')
      .select(`
        *,
        profiles!guides_creator_fid_fkey (username, pfp_url),
        guide_books (
          books (*)
        ),
        guide_likes (count)
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error("❌ Error fetching public guides:", error);
      return [];
    }

    // Transform data to Guide interface
    const transformedGuides: Guide[] = guides.map((guide: any) => ({
      id: guide.id,
      title: guide.title,
      description: guide.description,
      tags: guide.tags || [],
      isPublic: guide.is_public,
      createdAt: guide.created_at,
      authorId: 'unknown',
      authorFid: guide.creator_fid,
      authorUsername: guide.profiles?.username || 'Unknown',
      authorPfpUrl: guide.profiles?.pfp_url || '',
      likes: guide.guide_likes?.length || 0,
      dislikes: 0,
      books: guide.guide_books?.map((gb: any) => ({
        id: gb.books.id,
        title: gb.books.title,
        author: gb.books.author,
        notes: gb.books.notes,
        coverUrl: gb.books.cover_url,
        purchaseLink: gb.books.purchase_link,
        likes: 0,
        dislikes: 0
      })) || []
    }));

    console.log(`✅ Fetched ${transformedGuides.length} public guides`);
    return transformedGuides;
  } catch (error) {
    console.error("❌ Error in getPublicGuides:", error);
    return [];
  }
};

export const getRecommendedGuides = async (): Promise<Guide[]> => {
  try {
    console.log("⭐ Fetching recommended guides");
    
    // Get top liked guides as recommendations
    const { data: guides, error } = await supabase
      .from('guides')
      .select(`
        *,
        profiles!guides_creator_fid_fkey (username, pfp_url),
        guide_books (
          books (*)
        ),
        guide_likes (count)
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error("❌ Error fetching recommended guides:", error);
      return [];
    }

    // Transform and sort by likes
    const transformedGuides: Guide[] = guides.map((guide: any) => ({
      id: guide.id,
      title: guide.title,
      description: guide.description,
      tags: guide.tags || [],
      isPublic: guide.is_public,
      createdAt: guide.created_at,
      authorId: 'unknown',
      authorFid: guide.creator_fid,
      authorUsername: guide.profiles?.username || 'Unknown',
      authorPfpUrl: guide.profiles?.pfp_url || '',
      likes: guide.guide_likes?.length || 0,
      dislikes: 0,
      books: guide.guide_books?.map((gb: any) => ({
        id: gb.books.id,
        title: gb.books.title,
        author: gb.books.author,
        notes: gb.books.notes,
        coverUrl: gb.books.cover_url,
        purchaseLink: gb.books.purchase_link,
        likes: 0,
        dislikes: 0
      })) || []
    }));

    // Sort by likes and return top 5
    const recommended = transformedGuides
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 5);

    console.log(`✅ Fetched ${recommended.length} recommended guides`);
    return recommended;
  } catch (error) {
    console.error("❌ Error in getRecommendedGuides:", error);
    return [];
  }
};

export const getGuideById = async (id: number): Promise<Guide | undefined> => {
  try {
    console.log("📖 Fetching guide by ID:", id);
    
    const { data: guide, error } = await supabase
      .from('guides')
      .select(`
        *,
        profiles!guides_creator_fid_fkey (username, pfp_url),
        guide_books (
          books (*)
        ),
        guide_likes (count)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error("❌ Error fetching guide by ID:", error);
      return undefined;
    }

    if (!guide) {
      return undefined;
    }

    // Transform data to Guide interface
    const transformedGuide: Guide = {
      id: guide.id,
      title: guide.title,
      description: guide.description,
      tags: guide.tags || [],
      isPublic: guide.is_public,
      createdAt: guide.created_at,
      authorId: 'unknown',
      authorFid: guide.creator_fid,
      authorUsername: guide.profiles?.username || 'Unknown',
      authorPfpUrl: guide.profiles?.pfp_url || '',
      likes: guide.guide_likes?.length || 0,
      dislikes: 0,
      books: guide.guide_books?.map((gb: any) => ({
        id: gb.books.id,
        title: gb.books.title,
        author: gb.books.author,
        notes: gb.books.notes,
        coverUrl: gb.books.cover_url,
        purchaseLink: gb.books.purchase_link,
        likes: 0,
        dislikes: 0
      })) || []
    };

    console.log("✅ Guide fetched successfully");
    return transformedGuide;
  } catch (error) {
    console.error("❌ Error in getGuideById:", error);
    return undefined;
  }
};

export const createGuide = async (guideData: Omit<Guide, 'id' | 'createdAt' | 'authorId' | 'authorFid' | 'authorUsername' | 'authorPfpUrl' | 'likes' | 'dislikes'>, author: User): Promise<Guide> => {
  try {
    console.log("📝 Creating new guide:", guideData.title);
    
    if (!author.fid) {
      throw new Error("User FID is required to create a guide");
    }

    // Set user context for RLS
    await setUserContext(author.fid);

    // Start a transaction
    const { data: newGuide, error: guideError } = await supabase
      .from('guides')
      .insert({
        title: guideData.title,
        description: guideData.description,
        tags: guideData.tags,
        is_public: guideData.isPublic,
        creator_fid: author.fid
      })
      .select()
      .single();

    if (guideError) {
      console.error("❌ Error creating guide:", guideError);
      throw guideError;
    }

    // Create books and link them to the guide
    const createdBooks: Book[] = [];
    
    for (const book of guideData.books) {
      // First, create or get the book
      const { data: newBook, error: bookError } = await supabase
        .from('books')
        .insert({
          title: book.title,
          author: book.author,
          notes: book.notes,
          cover_url: book.coverUrl,
          purchase_link: book.purchaseLink
        })
        .select()
        .single();

      if (bookError) {
        console.error("❌ Error creating book:", bookError);
        continue; // Skip this book but continue with others
      }

      // Link the book to the guide
      const { error: linkError } = await supabase
        .from('guide_books')
        .insert({
          guide_id: newGuide.id,
          book_id: newBook.id
        });

      if (linkError) {
        console.error("❌ Error linking book to guide:", linkError);
        continue;
      }

      createdBooks.push({
        id: newBook.id,
        title: newBook.title,
        author: newBook.author,
        notes: newBook.notes,
        coverUrl: newBook.cover_url,
        purchaseLink: newBook.purchase_link,
        likes: 0,
        dislikes: 0
      });
    }

    const result: Guide = {
      id: newGuide.id,
      title: newGuide.title,
      description: newGuide.description,
      tags: newGuide.tags || [],
      isPublic: newGuide.is_public,
      createdAt: newGuide.created_at,
      authorId: author.id,
      authorFid: author.fid,
      authorUsername: author.username,
      authorPfpUrl: author.pfp_url,
      likes: 0,
      dislikes: 0,
      books: createdBooks
    };

    console.log("✅ Guide created successfully");
    return result;
  } catch (error) {
    console.error("❌ Error in createGuide:", error);
    throw error;
  }
};

export const updateGuide = async (id: number, guideData: Partial<Guide>): Promise<Guide> => {
  try {
    console.log("📝 Updating guide ID:", id);
    
    // Update the guide
    const { data: updatedGuide, error: guideError } = await supabase
      .from('guides')
      .update({
        title: guideData.title,
        description: guideData.description,
        tags: guideData.tags,
        is_public: guideData.isPublic
      })
      .eq('id', id)
      .select()
      .single();

    if (guideError) {
      console.error("❌ Error updating guide:", guideError);
      throw guideError;
    }

    // If books are provided, update them
    if (guideData.books) {
      // Remove existing book links
      await supabase
        .from('guide_books')
        .delete()
        .eq('guide_id', id);

      // Create new books and links
      const updatedBooks: Book[] = [];
      
      for (const book of guideData.books) {
        let bookId = book.id;
        
        if (!bookId || bookId < 1000) { // New book (temporary ID)
          // Create new book
          const { data: newBook, error: bookError } = await supabase
            .from('books')
            .insert({
              title: book.title,
              author: book.author,
              notes: book.notes,
              cover_url: book.coverUrl,
              purchase_link: book.purchaseLink
            })
            .select()
            .single();

          if (bookError) {
            console.error("❌ Error creating book:", bookError);
            continue;
          }
          bookId = newBook.id;
        } else {
          // Update existing book
          await supabase
            .from('books')
            .update({
              title: book.title,
              author: book.author,
              notes: book.notes,
              cover_url: book.coverUrl,
              purchase_link: book.purchaseLink
            })
            .eq('id', bookId);
        }

        // Link the book to the guide
        await supabase
          .from('guide_books')
          .insert({
            guide_id: id,
            book_id: bookId
          });

        updatedBooks.push({
          id: bookId,
          title: book.title,
          author: book.author,
          notes: book.notes,
          coverUrl: book.coverUrl,
          purchaseLink: book.purchaseLink,
          likes: book.likes || 0,
          dislikes: book.dislikes || 0
        });
      }

      // Return updated guide with books
      const result: Guide = {
        id: updatedGuide.id,
        title: updatedGuide.title,
        description: updatedGuide.description,
        tags: updatedGuide.tags || [],
        isPublic: updatedGuide.is_public,
        createdAt: updatedGuide.created_at,
        authorId: guideData.authorId || 'unknown',
        authorFid: updatedGuide.creator_fid,
        authorUsername: guideData.authorUsername || 'Unknown',
        authorPfpUrl: guideData.authorPfpUrl || '',
        likes: guideData.likes || 0,
        dislikes: guideData.dislikes || 0,
        books: updatedBooks
      };

      console.log("✅ Guide updated successfully");
      return result;
    }

    // If no books provided, fetch current guide data
    return await getGuideById(id) || updatedGuide as Guide;
  } catch (error) {
    console.error("❌ Error in updateGuide:", error);
    throw error;
  }
};

export const deleteGuide = async (id: number): Promise<{ success: boolean }> => {
  try {
    console.log("🗑️ Deleting guide ID:", id);
    
    // Delete guide (cascade will handle guide_books and guide_likes)
    const { error } = await supabase
      .from('guides')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("❌ Error deleting guide:", error);
      return { success: false };
    }

    console.log("✅ Guide deleted successfully");
    return { success: true };
  } catch (error) {
    console.error("❌ Error in deleteGuide:", error);
    return { success: false };
  }
};

// =================================================================================
// INTERACTION OPERATIONS
// =================================================================================

export const likeGuide = async (guideId: number): Promise<void> => {
  try {
    const { error } = await supabase
      .from('guide_likes')
      .insert({ guide_id: guideId });

    if (error && error.code !== '23505') { // Ignore duplicate key error
      console.error("❌ Error liking guide:", error);
      throw error;
    }
  } catch (error) {
    console.error("❌ Error in likeGuide:", error);
    throw error;
  }
};

export const unlikeGuide = async (guideId: number): Promise<void> => {
  try {
    const { error } = await supabase
      .from('guide_likes')
      .delete()
      .eq('guide_id', guideId);

    if (error) {
      console.error("❌ Error unliking guide:", error);
      throw error;
    }
  } catch (error) {
    console.error("❌ Error in unlikeGuide:", error);
    throw error;
  }
};

export const isGuideLiked = async (guideId: number): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('guide_likes')
      .select('id')
      .eq('guide_id', guideId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error("❌ Error checking guide like status:", error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error("❌ Error in isGuideLiked:", error);
    return false;
  }
};

// Placeholder functions for features not yet implemented
export const dislikeGuide = async (guideId: number): Promise<void> => {
  console.log("⚠️ Dislike feature not implemented yet");
};

export const undislikeGuide = async (guideId: number): Promise<void> => {
  console.log("⚠️ Undislike feature not implemented yet");
};

export const isGuideDisliked = async (guideId: number): Promise<boolean> => {
  return false; // Not implemented yet
};

export const likeBook = async (bookId: number): Promise<void> => {
  console.log("⚠️ Book like feature not implemented yet");
};

export const unlikeBook = async (bookId: number): Promise<void> => {
  console.log("⚠️ Book unlike feature not implemented yet");
};

export const dislikeBook = async (bookId: number): Promise<void> => {
  console.log("⚠️ Book dislike feature not implemented yet");
};

export const undislikeBook = async (bookId: number): Promise<void> => {
  console.log("⚠️ Book undislike feature not implemented yet");
};

export const getBookLikeStatusForGuide = async (guide: Guide): Promise<Record<number, boolean>> => {
  const status: Record<number, boolean> = {};
  guide.books.forEach(book => {
    status[book.id] = false; // Not implemented yet
  });
  return status;
};

export const getBookDislikeStatusForGuide = async (guide: Guide): Promise<Record<number, boolean>> => {
  const status: Record<number, boolean> = {};
  guide.books.forEach(book => {
    status[book.id] = false; // Not implemented yet
  });
  return status;
};