import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { TeamRepository } from '../../database/repositories/team-repository';
import { LoginInput } from '../../types/team';
import { generateTeamToken, verifyTeamToken, requireRole } from '../middleware/team-auth';
import { AppError } from '../middleware/error-handler';
import logger from '../../services/logger';

export function createTeamRouter(teamRepo: TeamRepository): Router {
  const router = Router();

  function param(req: Request, name: string): string {
    return req.params[name] as string;
  }

  // POST /login — authenticate team member
  router.post('/login', async (req: Request, res: Response) => {
    const { email, password } = LoginInput.parse(req.body);

    const memberRow = await teamRepo.getByEmail(email);
    if (!memberRow) {
      throw new AppError('Invalid email or password', 401, 'AUTH_INVALID');
    }

    if (!memberRow.active) {
      throw new AppError('Account is deactivated', 403, 'ACCOUNT_DISABLED');
    }

    const passwordValid = await bcrypt.compare(password, memberRow.password_hash);
    if (!passwordValid) {
      throw new AppError('Invalid email or password', 401, 'AUTH_INVALID');
    }

    const member = await teamRepo.getById(memberRow.id);
    if (!member) {
      throw new AppError('Member not found', 500, 'INTERNAL_ERROR');
    }

    const token = generateTeamToken(member);

    // Update status to online
    await teamRepo.updateStatus(member.id, 'online');

    logger.info(`Team member logged in: ${email}`);
    res.json({ token, member: { ...member, status: 'online' } });
  });

  // POST /logout — logout (requires auth)
  router.post('/logout', verifyTeamToken, async (req: Request, res: Response) => {
    const { memberId } = req.teamMember!;
    await teamRepo.updateStatus(memberId, 'offline');
    logger.info(`Team member logged out: ${memberId}`);
    res.json({ success: true });
  });

  // GET /me — current member profile
  router.get('/me', verifyTeamToken, async (req: Request, res: Response) => {
    const { memberId } = req.teamMember!;
    const member = await teamRepo.getById(memberId);
    if (!member) {
      throw new AppError('Member not found', 404, 'NOT_FOUND');
    }
    res.json(member);
  });

  // GET /members — list all team members
  router.get('/members', async (_req: Request, res: Response) => {
    const members = await teamRepo.getAll();
    res.json({ members });
  });

  // GET /members/available — available for chat
  router.get('/members/available', async (_req: Request, res: Response) => {
    const members = await teamRepo.getAvailableForChat();
    res.json({ members });
  });

  // POST /members — create team member (admin/manager only)
  router.post('/members', async (req: Request, res: Response) => {
    const { password, ...rest } = req.body;
    if (!password || password.length < 6) {
      throw new AppError('Password must be at least 6 characters', 400, 'VALIDATION_ERROR');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const member = await teamRepo.create({ ...rest, password: passwordHash });
    logger.info(`Team member created: ${member.email}`);
    res.status(201).json(member);
  });

  // PUT /members/:id — update team member
  router.put('/members/:id', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await teamRepo.getById(id);
    if (!existing) {
      throw new AppError('Member not found', 404, 'NOT_FOUND');
    }
    const updated = await teamRepo.updateMember(id, req.body);
    res.json(updated);
  });

  // DELETE /members/:id — delete team member
  router.delete('/members/:id', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await teamRepo.getById(id);
    if (!existing) {
      throw new AppError('Member not found', 404, 'NOT_FOUND');
    }
    await teamRepo.deleteById(id);
    res.json({ success: true });
  });

  // PUT /members/:id/status — update member status
  router.put('/members/:id/status', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const { status } = req.body;
    if (!status || !['online', 'away', 'busy', 'offline'].includes(status)) {
      throw new AppError('Invalid status', 400, 'VALIDATION_ERROR');
    }
    const updated = await teamRepo.updateStatus(id, status);
    res.json(updated);
  });

  return router;
}
