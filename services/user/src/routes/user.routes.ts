import { Router } from 'express';
import { UserModel } from '../models/user.model';
import {
  catchAsync,
  ValidationError,
  NotFoundError,
} from "../middleware/errorHandler";

const router = Router();

// create user
router.post(
  "/",
  catchAsync(async (req, res) => {
    const { email, name } = req.body;

    if (!email || !name) {
      throw new ValidationError("Missing required fields: email, name");
    }

    // Check if user already exists
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      throw new ValidationError("User with this email already exists");
    }

    const user = await UserModel.create({ email, name });

    res.status(201).json({
      status: "success",
      message: "User created successfully",
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
        },
      },
    });
  })
);

// list users
router.get(
  "/",
  catchAsync(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const users = await UserModel.find()
      .select("-__v")
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await UserModel.countDocuments();

    res.json({
      status: "success",
      results: users.length,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  })
);

// get user by id
router.get(
  "/:id",
  catchAsync(async (req, res) => {
    const user = await UserModel.findById(req.params.id).select("-__v");

    if (!user) {
      throw new NotFoundError("User not found");
    }

    res.json({
      status: "success",
      data: {
        user,
      },
    });
  })
);

// update user
router.patch(
  "/:id",
  catchAsync(async (req, res) => {
    const { email, name } = req.body;

    const user = await UserModel.findByIdAndUpdate(
      req.params.id,
      { email, name },
      { new: true, runValidators: true }
    ).select("-__v");

    if (!user) {
      throw new NotFoundError("User not found");
    }

    res.json({
      status: "success",
      message: "User updated successfully",
      data: {
        user,
      },
    });
  })
);

// delete user
router.delete(
  "/:id",
  catchAsync(async (req, res) => {
    const user = await UserModel.findByIdAndDelete(req.params.id);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    res.status(204).json({
      status: "success",
      message: "User deleted successfully",
    });
  })
);

export default router;
