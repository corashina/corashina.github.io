import React from 'react'
import { Link, graphql, StaticQuery } from 'gatsby'
import Container from '../components/container'

export default () => (
  <StaticQuery
    query={graphql`
      query SidebarItemsQuery {
        allSidebarItemsJson {
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
    <Container>
        <h1>test</h1>
        <Link to='/contact'>{data.allSidebarItemsJson.edges.map(item => <p>{item.node.name}</p>)}</Link>
    </Container>
    )}
  />
)
