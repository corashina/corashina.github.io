import React from "react";
import { Link, graphql } from "gatsby";
import Layout from "../components/Layout";
import WorkItem from "../components/WorkItem";

export default ({ location, data }) => {

  const introSection = (
    <div className="section">
      <h1>Tomasz Zielinski</h1>
      <div className="layout23">
        <div>
          <h2>an aspiring software engineer</h2>
          <p>
            Hello! I{"'"}m 75% technologist, 25% artist, and 100% perfectionist.
            I love making things, especially pretty 3D things with code!
          </p>
          <p>
            My background is in computer graphics, games, and animation. I
            graduated from the{" "}
            <a href="http://www.upenn.edu/">University of Pennsylvania</a> in{" "}
            <a href="http://cg.cis.upenn.edu/">computer graphics</a>. Then I
            went on to work in animation and gaming for a while at various
            places. Now I{"'"}m at{" "}
            <a href="http://www.autodesk.com/">Autodesk</a> working on an
            exciting <a href="http://lmv.rocks/">new web viewer</a>.
          </p>
        </div>
        <div>
          <h2>I use</h2>
          <p>
            html
            <br />
            css
            <br />
            javascript
            <br />
            threejs
            <br />
            <br />
            react
            <br />
            redux
            <br />
            gatsby
            <br />
            <br />
            graphql
            <br />
            node
            <br />
            <br />
            mongodb
            <br />
            postgres
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