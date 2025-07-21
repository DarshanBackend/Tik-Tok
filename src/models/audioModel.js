import mongoose from "mongoose";

const audioSchema = mongoose.Schema({
    audio_image: {
        type: String
    },
    artist_name: {
        type: Array
    },
    audio_name: {
        type: String
    },
    audio: {
        type: String
    },
    audioCategoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AudioCategory"
    }
}, { timestamps: true })

export default mongoose.model("Audio", audioSchema)