const { z } = require("zod");
function validate(schema) {
  return (req,res,next) => {
    const result = schema.safeParse({ params:req.params, query:req.query, body:req.body });
    if (!result.success) return res.status(400).json({ error:"Validation failed", details: result.error.issues });
    req.validated = result.data;
    next();
  };
}
const uuid = z.string().uuid();
const paginationSchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  }).passthrough(),
  body: z.object({}).passthrough()
});
module.exports = { validate, uuid, paginationSchema };
