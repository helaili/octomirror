export class OrganizationLifecyleEvent {
  name: string;
  event: 'created' | 'deleted';
  date: Date;

  constructor(name: string, event: 'created' | 'deleted', date: Date) {
    this.name = name;
    this.event = event;
    this.date = date;
  }
}

export class Organization {
  name: string;
  login: string;
  createdAt: Date;

  constructor(name: string, login: string, createdAt: Date) {
    this.name = name;
    this.login = login;
    this.createdAt = createdAt;
  }
}