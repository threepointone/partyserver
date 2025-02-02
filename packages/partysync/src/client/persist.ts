// This is a simple client-side persistence layer for PartySync.
// We use a indexeddb database to store the data.

// In this database, we store a table for each channel
// And the record is stored as
// key: record[0] // the id
// value: record // the record

import * as idb from "idb";

export class Persist<RecordType extends unknown[]> {
  private readonly dbName = "partysync";
  private readonly version = 1;

  constructor(private readonly channel: string) {}

  private async getDb() {
    const channel = this.channel;
    return idb.openDB(`${this.dbName}-${channel}`, this.version, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(channel)) {
          db.createObjectStore(channel, { keyPath: "key" });
        }
      }
    });
  }

  async getAll(): Promise<RecordType[]> {
    const db = await this.getDb();
    const records = await db.getAll(this.channel);

    const values = [];
    for (const record of records) {
      values.push(record.value);
    }
    values.sort(
      (a, b) => new Date(a.at(-3)).getTime() - new Date(b.at(-3)).getTime()
    ); // sort by created_at
    return values;
  }

  async set(records: RecordType[]): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(this.channel, "readwrite");
    const store = tx.objectStore(this.channel);

    for (const record of records) {
      await store.put({
        key: record[0],
        value: record
      });
    }

    await tx.done;
  }

  // async delete(id: string): Promise<void> {
  //   const db = await this.getDb();
  //   await db.delete(this.channel, id);
  // }

  async deleteDeletedRecordsBefore(date: Date): Promise<void> {
    const db = await this.getDb();
    const records = await db.getAll(this.channel);
    const tx = db.transaction(this.channel, "readwrite");
    const store = tx.objectStore(this.channel);

    const cutoff = date.getTime();
    for (const record of records) {
      if (
        record.value.at(-1) !== null &&
        new Date(record.value.at(-1)).getTime() < cutoff
      ) {
        await store.delete(record.key);
      }
    }
    await tx.done;
  }

  // async deleteAll(): Promise<void> {
  //   const db = await this.getDb();
  //   await db.clear(this.channel);
  // }
}
