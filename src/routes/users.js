// Users Routes
const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getCurrentUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  changePassword
} = require('../controllers/users');
const { body } = require('express-validator');
const authMiddleware = require('../middleware/authMiddleware');

// Validation rules
const authValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail({ gmail_remove_subaddress: false }),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('full_name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Full name must be between 1 and 100 characters'),
  body('phone')
    .optional()
    .trim()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number')
];

const passwordChangeValidation = [
  body('currentPassword')
    .isLength({ min: 1 })
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
];

// Admin registration validation
// Admin registration validation
const adminRegistrationValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail({ gmail_remove_subaddress: false }),
  body('password')
    .optional() // Password is auto-generated if not provided
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('full_name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Full name must be between 1 and 100 characters'),
  body('role')
    .optional()
    .isIn(['admin', 'board', 'chair_board', 'chairman', 'community_owner', 'community_lead', 'community_member', 'volunteer_head', 'priest', 'finance_team'])
    .withMessage('Invalid role selected'),
  body('roles')
    .optional()
    .isArray()
    .withMessage('Roles must be an array')
    // Custom validator to check if all roles in the array are valid
    .custom((roles) => {
      const validRoles = ['admin', 'board', 'chair_board', 'chairman', 'community_owner', 'community_lead', 'community_member', 'volunteer_head', 'priest', 'finance_team'];
      if (!roles.every(role => validRoles.includes(role))) {
        throw new Error('One or more invalid roles selected');
      }
      return true;
    })
];

// Routes
router.post('/register', authValidation, registerUser);
router.post('/admin-register', adminRegistrationValidation, registerUser); // Admin registration
router.post('/login', authValidation, loginUser);
router.get('/me', authMiddleware, getCurrentUser);
router.get('/', authMiddleware, getUsers);
router.get('/:id', authMiddleware, getUserById);
router.put('/:id', authMiddleware, updateUser);
router.delete('/:id', authMiddleware, deleteUser);
router.post('/change-password', authMiddleware, passwordChangeValidation, changePassword);

module.exports = router;
