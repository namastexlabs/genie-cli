export interface Model {
  id: string;
  created: number;
  owned_by: string;
}

export interface ModelsResponse {
  data: Model[];
  object: string;
}

export async function validateApiKeyAndGetModels(
  apiUrl: string,
  apiKey: string
): Promise<Model[] | null> {
  try {
    const response = await fetch(`${apiUrl}/v1/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as ModelsResponse;
    return data.data || [];
  } catch (error) {
    return null;
  }
}
