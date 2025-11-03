import { Router } from 'express';
import { ChatModel } from '../models/chat.model';
import {
  catchAsync,
  ValidationError,
  NotFoundError,
} from "../middleware/errorHandler";

const router = Router();

// post a chat message
router.post(
  "/",
  catchAsync(async (req, res) => {
    const { from, to, roomId, message } = req.body;

    if (!from || !message) {
      throw new ValidationError("Missing required fields: from, message");
    }

    if (!roomId && !to) {
      throw new ValidationError("Either roomId or to field is required");
    }

    const chat = await ChatModel.create({ from, to, roomId, message });

    res.status(201).json({
      status: "success",
      message: "Chat message sent successfully",
      data: {
        chat: {
          id: chat._id,
          from: chat.from,
          to: chat.to,
          roomId: chat.roomId,
          message: chat.message,
          createdAt: chat.createdAt,
        },
      },
    });
  })
);

// fetch recent messages for a room
router.get(
  "/room/:roomId",
  catchAsync(async (req, res) => {
    const { roomId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    if (!roomId) {
      throw new ValidationError("Room ID is required");
    }

    const messages = await ChatModel.find({ roomId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-__v")
      .lean();

    const total = await ChatModel.countDocuments({ roomId });

    res.json({
      status: "success",
      results: messages.length,
      data: {
        messages: messages.reverse(), // Reverse to show oldest first
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

// get direct messages between two users
router.get(
  "/direct/:userId1/:userId2",
  catchAsync(async (req, res) => {
    const { userId1, userId2 } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    if (!userId1 || !userId2) {
      throw new ValidationError("Both user IDs are required");
    }

    const messages = await ChatModel.find({
      $or: [
        { from: userId1, to: userId2 },
        { from: userId2, to: userId1 },
      ],
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-__v")
      .lean();

    const total = await ChatModel.countDocuments({
      $or: [
        { from: userId1, to: userId2 },
        { from: userId2, to: userId1 },
      ],
    });

    res.json({
      status: "success",
      results: messages.length,
      data: {
        messages: messages.reverse(),
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

// get chat message by id
router.get(
  "/:id",
  catchAsync(async (req, res) => {
    const chat = await ChatModel.findById(req.params.id).select("-__v");

    if (!chat) {
      throw new NotFoundError("Chat message not found");
    }

    res.json({
      status: "success",
      data: {
        chat,
      },
    });
  })
);

// delete chat message
router.delete(
  "/:id",
  catchAsync(async (req, res) => {
    const chat = await ChatModel.findByIdAndDelete(req.params.id);

    if (!chat) {
      throw new NotFoundError("Chat message not found");
    }

    res.status(204).json({
      status: "success",
      message: "Chat message deleted successfully",
    });
  })
);

export default router;
