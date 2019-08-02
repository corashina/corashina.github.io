import React from "react";
import { Link, graphql } from "gatsby";
import Layout from "../components/Layout";

const getImageUrl = (url) => (url.includes("http") ? url : `/portfolio/${url}`);

export default ({ data, location }) => {
  const work = data.worksJson;
  
  let detailLinkElem;
  if (work.link) {
    detailLinkElem = (
      <p>
        <a href={work.link}>launch →</a>
      </p>
    );
  }

  let imgElem
  if(work.url.includes('mp4')) {
      imgElem = (
    <video ref='video' loop>
        <source  src={getImageUrl(work.url)} type="video/mp4"/>
        <p>Your browser doesn't support HTML5 video</p>
    </video> 
  )
  } else {
    imgElem = (
    <img style={{width: '100%'}}src={getImageUrl(work.url)}/>)
  }


  const detailElem = (
    <div className="detail">
      <h1>{work.title}</h1>
      <p className="secondary">{work.date}</p>
      <p dangerouslySetInnerHTML={{ __html: work.description }} />
      {detailLinkElem}
      <h4>Tools</h4>
      {work.tools.map(tool => <p>{tool}</p>)}
    </div>
  );

  return (
    <Layout location={location} title={work.title} width={900}>
      <div className="work">
        <div>
          {detailElem}
            {imgElem}
        </div>
        {detailElem}
      </div>
    </Layout>
  );
};

export const pageQuery = graphql`
  query WorkBySlug($slug: String!) {
    worksJson(fields: { slug: { eq: $slug } }) {
      title
      description
      tools 
      date
      url
      link
    }
  }
`;
