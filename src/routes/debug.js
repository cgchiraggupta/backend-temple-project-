const express = require('express');
const router = express.Router();

// Debug endpoint to help troubleshoot frontend issues
router.post('/debug/application-action', async (req, res) => {
    try {
        console.log('🔍 DEBUG: Application action request received');
        console.log('📋 Headers:', req.headers);
        console.log('📋 Params:', req.params);
        console.log('📋 Query:', req.query);
        console.log('📋 Body:', req.body);
        console.log('📋 URL:', req.url);
        console.log('📋 Method:', req.method);

        res.json({
            success: true,
            message: 'Debug info logged to console',
            received_data: {
                headers: req.headers,
                params: req.params,
                query: req.query,
                body: req.body,
                url: req.url,
                method: req.method
            }
        });
    } catch (error) {
        console.error('Debug endpoint error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Debug endpoint for application ID validation
router.get('/debug/validate-id/:id', async (req, res) => {
    try {
        const { id } = req.params;

        console.log('🔍 DEBUG: Validating application ID');
        console.log('📋 Received ID:', id);
        console.log('📋 ID Type:', typeof id);
        console.log('📋 ID Length:', id?.length);
        console.log('📋 Is UUID format:', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

        const validation = {
            id: id,
            type: typeof id,
            length: id?.length,
            is_string: typeof id === 'string',
            is_empty: !id || id.trim() === '',
            is_undefined_string: id === 'undefined',
            is_null_string: id === 'null',
            is_uuid_format: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
            is_valid: id && id !== 'undefined' && id !== 'null' && id.trim() !== '' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        };

        res.json({
            success: true,
            validation
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;