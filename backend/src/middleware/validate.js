const { ZodError } = require("zod");

/**
 * validate.js
 * Wraps a Zod schema into Express middleware. Every route that accepts
 * user input validates it here before touching business logic - the API
 * returns a precise 400 with field-level errors instead of the request
 * limping into a service and throwing a confusing exception three layers deep.
 */
function validate(schema, source = "body") {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: "Validation failed",
          details: err.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
        });
      }
      next(err);
    }
  };
}

module.exports = validate;
