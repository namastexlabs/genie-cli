import { z } from 'zod';

export const ProfileSchema = z.object({
  opus: z.string(),
  sonnet: z.string(),
  haiku: z.string(),
});

export const ConfigSchema = z.object({
  apiUrl: z.string().url(),
  apiKey: z.string().min(1),
  profiles: z.record(ProfileSchema),
});

export type Profile = z.infer<typeof ProfileSchema>;
export type Config = z.infer<typeof ConfigSchema>;
