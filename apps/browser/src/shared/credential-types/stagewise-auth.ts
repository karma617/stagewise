import { z } from 'zod';
import { credentialField, type CredentialTypeDefinition } from './types';

const schema = z.object({
  accessToken: credentialField(),
});

type StageWiseAuthShape = typeof schema.shape;

export const stagewiseAuthCredentialType: CredentialTypeDefinition<StageWiseAuthShape> =
  {
    displayName: 'PickStar Studio Access Token',
    description:
      'Automatically provided when you are signed in to PickStar Studio. Grants access to the PickStar Studio API.',
    schema,
    allowedOrigins: ['https://*.stagewise.io'],
    fieldMetadata: {},
    onGet: async (current) => current,
  };
