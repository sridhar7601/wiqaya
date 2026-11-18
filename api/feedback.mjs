// Anonymous feedback counters (two ratings, time taken, language) shown on the Evidence page.
import { handler } from '../infra/server/feedback.mjs'
import { toVercel } from '../infra/server/http.mjs'

export default toVercel(handler)
