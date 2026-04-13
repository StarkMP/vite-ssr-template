import type { FastifyReply, FastifyRequest } from 'fastify';

export type ServerSideRenderingSetup = {
  handleRequest: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  fixStacktrace?: (error: Error) => void;
};
