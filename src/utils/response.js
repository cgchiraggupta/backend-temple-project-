// API Response utility
class ApiResponse {
    static success(res, data = null, message = 'Success', statusCode = 200) {
        return res.status(statusCode).json({
            success: true,
            message,
            data
        });
    }

    static error(res, message = 'Error', statusCode = 500, error = null) {
        return res.status(statusCode).json({
            success: false,
            message,
            error
        });
    }
}

module.exports = ApiResponse;
