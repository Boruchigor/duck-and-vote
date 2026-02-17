const express = require("express");

const router = express.Router();
const cpNumberRegex = /^CP-(\d+)$/i;
const closedStateTypes = new Set(["completed", "canceled"]);

const cpRank = (identifier) => {
  const match = (identifier || "").trim().match(cpNumberRegex);
  return match ? Number(match[1]) : Number.NEGATIVE_INFINITY;
};

const isOpenState = (stateType) => !closedStateTypes.has((stateType || "").toLowerCase());

router.get("/linear/issues", async (req, res) => {
  const apiKey = process.env.LINEAR_API_KEY;
  const search = (req.query.search || "").trim();
  const limit = Math.min(Number(req.query.limit || 10), 50);
  const first = Math.max(limit, 200);

  if (!apiKey) {
    return res.status(400).json({
      message: "LINEAR_API_KEY is not configured on the server.",
    });
  }

  const isSearchMode = Boolean(search);
  const query = `
    query RecentIssues($first: Int!) {
      issues(first: $first, orderBy: updatedAt) {
        nodes {
          id
          identifier
          title
          state {
            type
          }
        }
      }
    }
  `;

  try {
    const requestBody = JSON.stringify({
      query,
      variables: {
        first,
      },
    });

    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: requestBody,
    });

    if (!response.ok) {
      let upstreamMessage = null;
      try {
        const errorPayload = await response.json();
        upstreamMessage =
          errorPayload?.errors?.[0]?.message ||
          errorPayload?.message ||
          null;
      } catch (parseError) {
        upstreamMessage = null;
      }

      return res.status(response.status === 401 ? 401 : 502).json({
        message:
          response.status === 401
            ? "Linear authentication failed. Check LINEAR_API_KEY."
            : upstreamMessage || "Linear request failed.",
        status: response.status,
      });
    }

    const data = await response.json();
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      return res.status(502).json({
        message: data.errors[0].message || "Linear returned an error.",
      });
    }

    let issues = data?.data?.issues?.nodes || [];

    if (!isSearchMode) {
      issues = issues
        .filter((issue) => cpRank(issue.identifier) !== Number.NEGATIVE_INFINITY)
        .filter((issue) => isOpenState(issue?.state?.type))
        .sort((a, b) => cpRank(b.identifier) - cpRank(a.identifier));
    } else {
      const searchTerm = search.toLowerCase();
      issues = issues.filter((issue) => {
        const identifier = (issue.identifier || "").toLowerCase();
        const title = (issue.title || "").toLowerCase();
        return identifier.includes(searchTerm) || title.includes(searchTerm);
      });
    }

    const tasks = issues.slice(0, limit).map((issue) => ({
      id: issue.id,
      linearIssueId: issue.id,
      identifier: issue.identifier,
      title: `${issue.identifier}: ${issue.title}`,
    }));

    return res.status(200).json({ tasks });
  } catch (error) {
    console.error("Error fetching Linear issues:", error);
    return res.status(500).json({ message: "Failed to fetch Linear issues." });
  }
});

module.exports = router;
