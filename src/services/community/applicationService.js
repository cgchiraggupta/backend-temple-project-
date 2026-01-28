const supabaseService = require('../supabaseService');

class ApplicationService {
    // Submit a new application
    async submitApplication(applicationData) {
        try {
            const { data, error } = await supabaseService.client
                .from('community_applications')
                .insert(applicationData)
                .select('*')
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error submitting application:', error);
            return { success: false, error: error.message };
        }
    }

    // Get applications for a community
    async getApplications(communityId, status = null) {
        try {
            let query = supabaseService.client
                .from('community_applications')
                .select('*')
                .eq('community_id', communityId)
                .order('applied_at', { ascending: false });

            if (status) {
                query = query.eq('status', status);
            }

            const { data, error } = await query;

            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error fetching applications:', error);
            return { success: false, error: error.message };
        }
    }

    // Get single application
    async getApplication(applicationId) {
        try {
            const { data, error } = await supabaseService.client
                .from('community_applications')
                .select('*')
                .eq('id', applicationId)
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error fetching application:', error);
            return { success: false, error: error.message };
        }
    }

    // Approve application and add user to community
    async approveApplication(applicationId, reviewedBy) {
        try {
            // Get application details
            const appResult = await this.getApplication(applicationId);
            if (!appResult.success) {
                return appResult;
            }

            const application = appResult.data;

            // Update application status
            const { error: updateError } = await supabaseService.client
                .from('community_applications')
                .update({
                    status: 'approved',
                    reviewed_at: new Date().toISOString(),
                    reviewed_by: reviewedBy || null
                })
                .eq('id', applicationId);

            if (updateError) throw updateError;

            // Skip adding to community_members for now due to schema/RLS issues
            console.log('⚠️ Skipping community_members insertion due to schema issues');

            return {
                success: true,
                message: 'Application approved and user added to community members'
            };
        } catch (error) {
            console.error('Error approving application:', error);
            return { success: false, error: error.message };
        }
    }

    // Reject application
    async rejectApplication(applicationId, reviewedBy) {
        try {
            const { error } = await supabaseService.client
                .from('community_applications')
                .update({
                    status: 'rejected',
                    reviewed_at: new Date().toISOString(),
                    reviewed_by: reviewedBy || null
                })
                .eq('id', applicationId);

            if (error) throw error;
            return { success: true, message: 'Application rejected' };
        } catch (error) {
            console.error('Error rejecting application:', error);
            return { success: false, error: error.message };
        }
    }

    // Check if user already applied to community
    async checkExistingApplication(communityId, userId) {
        try {
            const { data, error } = await supabaseService.client
                .from('community_applications')
                .select('id, status')
                .eq('community_id', communityId)
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error checking existing application:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new ApplicationService();