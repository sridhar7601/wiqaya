// AI care search: free text in, directory filters out. The rate limit and daily cap are inside the handler.
import { handler } from '../infra/ai/navigate.mjs'
import { toVercel } from '../infra/server/http.mjs'

export default toVercel(handler)
