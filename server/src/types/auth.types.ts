export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: Date;
}