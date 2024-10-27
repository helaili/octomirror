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