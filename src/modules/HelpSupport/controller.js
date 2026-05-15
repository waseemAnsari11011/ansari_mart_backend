const HelpSupport = require('./model');

// Get Help & Support details
exports.getHelpSupport = async (req, res) => {
    try {
        let helpSupport = await HelpSupport.findOne();
        if (!helpSupport) {
            helpSupport = new HelpSupport({
                mobile: '',
                email: ''
            });
            await helpSupport.save();
        }
        res.status(200).json(helpSupport);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Update Help & Support details
exports.updateHelpSupport = async (req, res) => {
    try {
        const { mobile, email } = req.body;
        let helpSupport = await HelpSupport.findOne();
        
        if (!helpSupport) {
            helpSupport = new HelpSupport({ mobile, email });
        } else {
            helpSupport.mobile = mobile || helpSupport.mobile;
            helpSupport.email = email || helpSupport.email;
        }
        
        await helpSupport.save();
        res.status(200).json({ message: "Help & Support updated successfully", helpSupport });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
