declare module 'sql.js' {
  export interface Statement {
    bind(params?: any): boolean;
    step(): boolean;
    get(): any[];
    getAsObject(): { [key: string]: any };
    run(params?: any): { lastInsertRowid: number };
    all(params?: any): any[];
    free(): void;
  }

  export interface QueryExecResult {
    columns: string[];
    values: any[][];
  }

  export interface Database {
    exec(sql: string): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database;
  }

  export default function initSqlJs(options?: any): Promise<SqlJsStatic>;
}
