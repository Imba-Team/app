import { Role } from '../decorators/roles.decorator';

export interface IUser {
  id: string;
  email: string;
  name: string;
  status: string | null;
  password: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}
