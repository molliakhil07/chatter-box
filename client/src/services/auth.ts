const API_BASE_URL = "http://localhost:5000/api";

export type RegisterInput = {
  email: string;
  username: string;
  password: string;
  displayName: string;
};

async function getErrorMessage(
  response: Response,
): Promise<string> {
  try {
    const data = await response.json();

    if (typeof data?.error === "string") {
      return data.error;
    }

    if (
      data?.error &&
      typeof data.error.message === "string"
    ) {
      return data.error.message;
    }
  } catch {
    // Use the generic message below.
  }

  return "Unable to complete authentication. Please try again.";
}

export async function login(
  identity: string,
  password: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/auth/login`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        identity,
        password,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response),
    );
  }
}

export async function register(
  input: RegisterInput,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/auth/register`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response),
    );
  }
}


export async function logout(): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/auth/logout`,
    {
      method: "POST",
      credentials: "include",
    },
  );

  if (!response.ok && response.status !== 204) {
    throw new Error(
      await getErrorMessage(response),
    );
  }
}
