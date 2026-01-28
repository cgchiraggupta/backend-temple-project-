const supabaseService = require('../supabaseService');

class MemberService {
    // Get community members
    async getCommunityMembers(communityId, filters = {}) {
        try {
            const { data, error } = await supabaseService.client
                .from('community_members')
                .select('*')
                .eq('community_id', communityId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching community members:', error);
            throw error;
        }
    }

    // Add member to community
    async addMember(memberData) {
        try {
            const { data, error } = await supabaseService.client
                .from('community_members')
                .insert(memberData)
                .select('*')
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error adding member:', error);
            throw error;
        }
    }

    // Update member
    async updateMember(communityId, userId, updateData) {
        try {
            const { data, error } = await supabaseService.client
                .from('community_members')
                .update(updateData)
                .eq('community_id', communityId)
                .eq('user_id', userId)
                .select('*')
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error updating member:', error);
            throw error;
        }
    }

    // Remove member
    async removeMember(communityId, userId) {
        try {
            const { error } = await supabaseService.client
                .from('community_members')
                .delete()
                .eq('community_id', communityId)
                .eq('user_id', userId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error removing member:', error);
            throw error;
        }
    }
}

module.exports = new MemberService();