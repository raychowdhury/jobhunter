declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    CAREER_OPS_OWNER_EMAIL?: string;
    CAREER_OPS_OWNER_RECORD_KEY?: string;
    CAREER_OPS_PRIVATE_ACCESS_BOUNDARY?: string;
    CAREER_OPS_DISPATCH_SERVICE?: string;
  }
}
