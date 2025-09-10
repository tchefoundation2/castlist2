import { Activity } from '../types';
import supabase from './supabaseService';

/**
 * Logs a new user activity to the database.
 * @param action - The action performed (e.g., 'Liked', 'Shared').
 * @param itemTitle - The title of the item related to the action (e.g., guide title).
 */
export const logActivity = async (action: string, itemTitle: string): Promise<void> => {
  try {
    console.log("📝 Logging activity:", action, itemTitle);
    
    const { error } = await supabase
      .from('activities')
      .insert({
        action,
        item_title: itemTitle,
        timestamp: new Date().toISOString()
      });

    if (error) {
      console.error("❌ Error logging activity:", error);
      throw error;
    }

    console.log("✅ Activity logged successfully");
  } catch (error) {
    console.error("❌ Error in logActivity:", error);
    // Don't throw error to prevent breaking the main flow
  }
};

/**
 * Retrieves the user's activity log from the database.
 * @param userId - The user ID to get activities for.
 * @returns An array of activity objects.
 */
export const getActivityLog = async (userId: string): Promise<Activity[]> => {
  try {
    console.log("📋 Fetching activity log for user:", userId);
    
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

    const { data: activities, error } = await supabase
      .from('activities')
      .select('*')
      .eq('user_fid', profile.fid)
      .order('timestamp', { ascending: false })
      .limit(50);

    if (error) {
      console.error("❌ Error fetching activities:", error);
      return [];
    }

    // Transform data to Activity interface
    const transformedActivities: Activity[] = activities.map((activity: any) => ({
      action: activity.action,
      itemTitle: activity.item_title,
      timestamp: activity.timestamp
    }));

    console.log(`✅ Fetched ${transformedActivities.length} activities`);
    return transformedActivities;
  } catch (error) {
    console.error("❌ Error in getActivityLog:", error);
    return [];
  }
};