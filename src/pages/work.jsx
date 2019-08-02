import React from 'react'
import { graphql, StaticQuery } from 'gatsby'
import Layout from '../components/layout'

export default ({ data }) => (
  <StaticQuery
    query={graphql`
      query WorkJsonQuery {
        allWorkJson {
          edges {
            node {
                name
                link
            }
          }
        }
      }
    `}
    render={data => (
         <Layout>
            {data.allWorkJson.edges.map(item => <p key={item.node.name}>{item.node.name}</p>)}
         </Layout>
    )}
  />
)
