// Vercel adapter for the same AI function used on AWS Lambda, with the shared rate limit and daily cap in front.
import { handler } from '../infra/ai/index.mjs'
import { toVercel } from '../infra/server/http.mjs'
import { guarded } from '../infra/server/limits.mjs'

export default toVercel(guarded('explain', handler))
