const express = require("express");

const router = express.Router();

router.get("/linear/issues", async (req, res) => {
  const apiKey = 'lin_api_vPGoe2EQG7EuMuoifmjI0VL35W8qAACMvnkRq0jK';
  const search = (req.query.search || "").trim();
  const limit = Math.min(Number(req.query.limit || 10), 50);

  if (!apiKey) {
    return res.status(400).json({
      message: "LINEAR_API_KEY is not configured on the server.",
    });
  }

  const query = `
    query SearchIssues($search: String!, $first: Int!) {
      issueSearch(query: $search, first: $first) {
        nodes {
          id
          identifier
          title
        }
      }
    }
  `;

  try {
    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          search,
          first: limit,
        },
      }),
    });

    if (!response.ok) {
      return res.status(502).json({
        message: "Linear request failed.",
        status: response.status,
      });
    }

    const data = await response.json();
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      return res.status(502).json({
        message: data.errors[0].message || "Linear returned an error.",
      });
    }

    const issues = data?.data?.issueSearch?.nodes || [];
    const tasks = issues.map((issue) => ({
      id: issue.id,
      title: `${issue.identifier}: ${issue.title}`,
    }));

    return res.status(200).json({ tasks });
  } catch (error) {
    console.error("Error fetching Linear issues:", error);
    return res.status(500).json({ message: "Failed to fetch Linear issues." });
  }
});

module.exports = router;
