const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const Shop = require('../models/Shop');
const Supplier = require('../models/Supplier');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { 
      firstName, lastName, username, email, phone, password, accountType,
      businessName, businessRegNumber, nicNumber, address, city, province, postalCode
    } = req.body;

    // Validate required fields based on account type
    if (accountType === 'SHOP_OWNER' || accountType === 'SUPPLIER') {
      if (!businessName || !businessRegNumber) {
        return res.status(400).json({
          success: false,
          message: 'Business Name and Business Registration Number are required for Shop Owners and Suppliers',
        });
      }
    }

    if (accountType === 'CUSTOMER') {
      if (!nicNumber) {
        return res.status(400).json({
          success: false,
          message: 'NIC Number is required for Customers',
        });
      }
    }

    // Check if user already exists
    const existingUserByEmail = await User.findByEmail(email);
    if (existingUserByEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered',
      });
    }

    const existingUserByUsername = await User.findByUsername(username);
    if (existingUserByUsername) {
      return res.status(400).json({
        success: false,
        message: 'Username already taken',
      });
    }

    // Check for duplicate business registration number
    if (businessRegNumber) {
      const existingBusiness = await User.findByBusinessRegNumber(businessRegNumber);
      if (existingBusiness) {
        return res.status(400).json({
          success: false,
          message: 'Business Registration Number already registered',
        });
      }
    }

    // Check for duplicate NIC
    if (nicNumber) {
      const existingNIC = await User.findByNIC(nicNumber);
      if (existingNIC) {
        return res.status(400).json({
          success: false,
          message: 'NIC Number already registered',
        });
      }
    }

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      username,
      email,
      phone,
      password,
      accountType,
      businessName,
      businessRegNumber,
      nicNumber,
      address,
      city,
      province,
      postalCode,
    });

    // Create Shop or Supplier profile
    if (accountType === 'SHOP_OWNER') {
      await Shop.create({
        ownerId: user.id,
        shopName: businessName,
        businessRegNumber: businessRegNumber,
        phone: phone,
        email: email,
        address: address || 'Not provided',
        city: city || 'Not provided',
        province: province,
        postalCode: postalCode,
      });
    } else if (accountType === 'SUPPLIER') {
      await Supplier.create({
        userId: user.id,
        companyName: businessName,
        businessRegNumber: businessRegNumber,
        phone: phone,
        email: email,
        address: address || 'Not provided',
        city: city || 'Not provided',
        province: province,
        postalCode: postalCode,
      });
    }

    // Generate token
    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: user.role,
          businessName: user.business_name,
          businessRegNumber: user.business_reg_number,
          nicNumber: user.nic_number,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration',
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { email, password, loginAs } = req.body;

    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check password
    const isPasswordValid = await User.verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check role match
    if (loginAs && user.role !== loginAs) {
      return res.status(403).json({
        success: false,
        message: `This account is registered as ${user.role}, not ${loginAs}`,
      });
    }

    // Generate token
    const token = generateToken(user.id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profile_image,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, email, username, phoneNumber, profileImage } = req.body;

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use',
        });
      }
    }

    // Check if username is being changed and if it's already taken
    if (username && username !== user.username) {
      const existingUser = await User.findByUsername(username);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken',
        });
      }
    }

    // Update user
    const updatedUser = await User.update(req.user.id, {
      first_name: firstName || user.first_name,
      last_name: lastName || user.last_name,
      email: email || user.email,
      username: username || user.username,
      phone: phoneNumber || user.phone,
      profile_image: profileImage !== undefined ? profileImage : user.profile_image,
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updatedUser.id,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        username: updatedUser.username,
        email: updatedUser.email,
        phoneNumber: updatedUser.phone,
        role: updatedUser.role,
        profileImage: updatedUser.profile_image || updatedUser.profileImage,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};
