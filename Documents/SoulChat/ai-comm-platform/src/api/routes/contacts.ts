import { Router, Request, Response } from 'express';
import { ConversationEngine } from '../../conversation/conversation-engine';
import { AppError } from '../middleware/error-handler';

export function createContactsRouter(engine: ConversationEngine): Router {
  const router = Router();
  const contactManager = engine.getContactManager();
  const convManager = engine.getConversationManager();

  function param(req: Request, name: string): string {
    return req.params[name] as string;
  }

  /**
   * @swagger
   * /api/contacts:
   *   get:
   *     summary: List contacts
   *     tags: [Contacts]
   *     parameters:
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: List of contacts
   */
  router.get('/', (req: Request, res: Response) => {
    const { search, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);

    let contacts = search
      ? contactManager.searchContacts(search as string)
      : contactManager.getAllContacts();

    const total = contacts.length;
    const start = (pageNum - 1) * limitNum;
    contacts = contacts.slice(start, start + limitNum);

    res.json({
      contacts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  });

  /**
   * @swagger
   * /api/contacts/{id}:
   *   get:
   *     summary: Get contact details with conversation summary
   *     tags: [Contacts]
   */
  router.get('/:id', (req: Request, res: Response) => {
    const id = param(req, 'id');
    const contact = contactManager.getContact(id);
    if (!contact) {
      throw new AppError('Contact not found', 404, 'NOT_FOUND');
    }

    const conversations = convManager.findConversations({ contactId: id });

    res.json({
      ...contact,
      conversations: conversations.map(c => ({
        id: c.id,
        status: c.status,
        channel: c.channel,
        currentAgent: c.currentAgent,
        messageCount: c.messages.length,
        startedAt: c.startedAt,
        updatedAt: c.updatedAt,
      })),
    });
  });

  /**
   * @swagger
   * /api/contacts/{id}:
   *   put:
   *     summary: Update contact info
   *     tags: [Contacts]
   */
  router.put('/:id', (req: Request, res: Response) => {
    const id = param(req, 'id');
    const contact = contactManager.getContact(id);
    if (!contact) {
      throw new AppError('Contact not found', 404, 'NOT_FOUND');
    }

    const updated = contactManager.updateContact(id, req.body);
    res.json(updated);
  });

  /**
   * @swagger
   * /api/contacts/{id}/tags:
   *   post:
   *     summary: Add tag to contact
   *     tags: [Contacts]
   */
  router.post('/:id/tags', (req: Request, res: Response) => {
    const id = param(req, 'id');
    const contact = contactManager.getContact(id);
    if (!contact) {
      throw new AppError('Contact not found', 404, 'NOT_FOUND');
    }

    const { tag } = req.body;
    if (!tag) {
      throw new AppError('tag is required', 400, 'VALIDATION_ERROR');
    }

    const updated = contactManager.addTag(id, tag);
    res.json(updated);
  });

  /**
   * @swagger
   * /api/contacts/{id}/tags/{tag}:
   *   delete:
   *     summary: Remove tag from contact
   *     tags: [Contacts]
   */
  router.delete('/:id/tags/:tag', (req: Request, res: Response) => {
    const id = param(req, 'id');
    const tag = param(req, 'tag');
    const contact = contactManager.getContact(id);
    if (!contact) {
      throw new AppError('Contact not found', 404, 'NOT_FOUND');
    }

    const updated = contactManager.removeTag(id, tag);
    res.json(updated);
  });

  return router;
}
