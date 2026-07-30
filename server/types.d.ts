declare module 'sql.js' {
  export interface Database {
    exec(sql: string): void;
    prepare(sql: string): Statement;
    export(): Uint8Array;
  }

  export interface Statement {
    run(...params: any[]): { lastInsertRowid: number };
    all(...params: any[]): any[];
    get(...params: any[]): any;
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database;
  }

  export default function initSqlJs(options?: any): Promise<SqlJsStatic>;
}