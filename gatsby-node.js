const path = require("path");
const { createFilePath } = require("gatsby-source-filesystem");

const slugify = (text) =>
  text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "") // Remove all non-word chars
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text

exports.onCreateNode = ({ node, actions, getNode }) => {
  const { createNodeField } = actions;

  if (node.internal.type === "MarkdownRemark") {
    const filepath = createFilePath({ node, getNode });

    let type;
    let slug;

      type = "page";
      slug = filepath;

    createNodeField({ node, name: "slug", value: slug });
    createNodeField({ node, name: "type", value: type });
  }

  if (node.internal.type === "WorksJson") {
    const slug = `/works/${slugify(node.title)}`;
    createNodeField({ node, name: "slug", value: slug });
  }
};

const createWorkPages = ({ graphql, actions }) => {
  const { createPage } = actions;

  const workTemplate = path.resolve("./src/templates/work.jsx");

  return graphql(`
    {
      allWorksJson {
        edges {
          node {
            fields {
              slug
            }
          }
        }
      }
    }
  `).then((result) => {
    if (result.errors) {
      throw new Error(result.errors);
    }
    
    const works = result.data.allWorksJson.edges;
    works.forEach((work) => {
      const { slug } = work.node.fields;
      createPage({
        path: slug,
        component: workTemplate,
        context: {
          slug,
        },
      });
    });
  });
};

exports.createPages = ({ graphql, actions }) =>
  Promise.resolve()
    .then(() => createWorkPages({ graphql, actions }));
