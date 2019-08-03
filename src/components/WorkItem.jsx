import React, { Component } from 'react'
import { Link } from 'gatsby'

const getUrl = url => (url.includes('http') ? url : `/portfolio/${url}`)

export default class WorkItem extends Component {
    constructor(props) {
        super(props)

        this.handleMouseOver = this.handleMouseOver.bind(this)
        this.handleMouseOut = this.handleMouseOut.bind(this)

    }
    handleMouseOver(e) {
        
        e.preventDefault()
        this.refs.video.play()
   
    }
    handleMouseOut(e) {
        
        e.preventDefault()
        this.refs.video.pause()
        this.currentTime = 0
    
    }
    render() {
        const elem = this.props.url.includes('mp4') ? (
            <video
                ref="video"
                loop
                onMouseOver={this.handleMouseOver}
                onMouseOut={this.handleMouseOut}
            >
                <source src={getUrl(this.props.url)} type="video/mp4" />
                <p>Your browser doesn't support HTML5 video</p>
            </video>
        ) : (
                <img
                    className="image"
                    src={getUrl(this.props.url)}
                />
        )
        return (
            <Link to={this.props.slug}>
                <div className='item'>
                    <div className='image-wrap'>
                      {elem}
                      {this.props.title}
                    </div>    
              
                </div>
            </Link>
        )
    }
}
