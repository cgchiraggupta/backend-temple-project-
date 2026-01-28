const COMMUNITY_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived'
};

const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100
};

const ROLES = {
  ADMIN: 'admin',
  BOARD: 'board',
  CHAIR_BOARD: 'chair_board',
  CHAIRMAN: 'chairman',
  FINANCE: 'finance_team', // Updated from 'finance'
  COMMUNITY_OWNER: 'community_owner',
  COMMUNITY_LEAD: 'community_lead',
  COMMUNITY_MEMBER: 'community_member',
  VOLUNTEER_COORDINATOR: 'volunteer_coordinator',
  PRIEST: 'priest',
  VOLUNTEER: 'volunteer',
  PUBLIC: 'public'
};

const PERMISSIONS = {
  CAN_CREATE_COMMUNITY: [
    ROLES.ADMIN,
    ROLES.BOARD,
    ROLES.CHAIR_BOARD, // Added
    ROLES.CHAIRMAN,    // Added
    ROLES.COMMUNITY_OWNER
  ],
  CAN_MANAGE_COMMUNITY: [
    ROLES.ADMIN,
    ROLES.BOARD,
    ROLES.CHAIR_BOARD, // Added
    ROLES.CHAIRMAN,    // Added
    ROLES.COMMUNITY_OWNER,
    ROLES.COMMUNITY_LEAD
  ],
  CAN_VIEW_FINANCE: [
    ROLES.ADMIN,
    ROLES.BOARD,
    ROLES.CHAIR_BOARD, // Added
    ROLES.CHAIRMAN,    // Added
    ROLES.FINANCE
  ],
};

module.exports = {
  COMMUNITY_STATUS,
  PAGINATION,
  ROLES,
  PERMISSIONS
};


