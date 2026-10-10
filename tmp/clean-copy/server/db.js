import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
mkdirSync('data',{recursive:true});
export function openDb(path=process.env.DB_PATH||'data/supermarket.sqlite') {
 const db=new DatabaseSync(path); db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,created TEXT,seed INTEGER,config TEXT,submitted INTEGER DEFAULT 0);
 CREATE TABLE IF NOT EXISTS history(run_id TEXT NOT NULL REFERENCES runs(id),seq INTEGER NOT NULL,day INTEGER NOT NULL,type TEXT NOT NULL,product_id TEXT,payload TEXT NOT NULL,PRIMARY KEY(run_id,seq));
 CREATE INDEX IF NOT EXISTS history_day ON history(run_id,day,type);
 CREATE TRIGGER IF NOT EXISTS history_no_update BEFORE UPDATE ON history BEGIN SELECT RAISE(ABORT,'History is append-only'); END;
 CREATE TRIGGER IF NOT EXISTS history_no_delete BEFORE DELETE ON history BEGIN SELECT RAISE(ABORT,'History is append-only'); END;
 CREATE TRIGGER IF NOT EXISTS runs_no_update BEFORE UPDATE ON runs BEGIN SELECT RAISE(ABORT,'Run configuration is frozen'); END;
 CREATE TRIGGER IF NOT EXISTS runs_no_delete BEFORE DELETE ON runs BEGIN SELECT RAISE(ABORT,'Runs are retained'); END;`);return db;
}
export function events(db,id){return db.prepare('SELECT seq,day,type,product_id,payload FROM history WHERE run_id=? ORDER BY seq').all(id).map(x=>({...x,...JSON.parse(x.payload),payload:undefined}));}
