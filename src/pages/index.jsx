import React from "react";
import { Link, graphql } from "gatsby";
import Layout from "../components/Layout";
import WorkItem from "../components/WorkItem";

import styles from '../components/styles/section.module.scss'

export default ({ location, data }) => {

  const introSection = (
    <div className="section">
      <h1>Tomasz Zielinski</h1>
      <div className={styles.section}>
        <div>
          <h2>an aspiring software engineer</h2>
          <p>
            Web enthusiast with experience in software development and architecture. 
            Interested in network programming, web-based architecture, web-based authentication and unix systems. 
            Advocate of fast paced development environments that embrace continuous change. 
            Student at the University of Southampton.
          </p>
          <p>
            Accomplishing my goals with a variety of tools, predominantly web stuff such as Javascript, React, Redux, Node. 
            Always ready to grasp new concepts and learn different technologies.
          </p>
        </div>
        <div>
          <h2>i use</h2>
          <p>
            
            
            javascript
            <br />
            typescript
            <br />
            scss
            <br />
            three
            <br />
            <br />
            react
            <br />
            redux
            <br />
            gatsby
            <br />
            <br />
            node
            <br />
            nosql
            <br />
            mongo
            <br />
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <Layout location={location}>
      {introSection}
    </Layout>
  );
};
