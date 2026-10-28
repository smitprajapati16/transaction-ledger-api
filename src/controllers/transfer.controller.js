const transferService = require('../services/transfer.service');

class TransferController {
  async transfer(req, res, next) {
    try {
      const {
        source_account_id,
        destination_account_id,
        amount,
        description,
        reference_id,
      } = req.body;

      const result = await transferService.transferFunds({
        source_account_id,
        destination_account_id,
        amount,
        description,
        reference_id,
      });

      res.status(200).json({
        success: true,
        message: 'Funds transferred successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TransferController();

