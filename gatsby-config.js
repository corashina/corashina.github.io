module.exports = {
  siteMetadata: {
      title: "XD"
  },
  plugins: [
    {
      resolve: `gatsby-plugin-typography`,
      options: {
        pathToConfigModule: `src/utils/typography`,
      },
    },
    {
        resolve: `gatsby-plugin-sass`
    },
    // {
    //   resolve: `gatsby-plugin-manifest`,
    //   options: {
    //     name: `GatsbyJS`,
    //     short_name: `GatsbyJS`,
    //     start_url: `/`,
    //     background_color: `#6b37bf`,
    //     theme_color: `#6b37bf`,
    //     display: `standalone`,
    //     icon: `src/images/icon.png`,
    //   },
    // },
    `gatsby-plugin-offline`,
    `gatsby-transformer-json`,
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `data`,
        path: `${__dirname}/src/data/`,
      },
    },
  ]
}